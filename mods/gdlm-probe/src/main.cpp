// GDLM Probe: logs the player's state on every physics tick and every press, one JSON-lines file per attempt,
// and plays a route back (presses on exact ticks) when told to by a command file. Files go to the mod's save
// folder (<GD save dir>/geode/mods/gdlm.probe/). Read them with tools/probe.js (GEODE.md).
//
// Line types in attempts/*.jsonl (all one JSON object per line):
//   {"t":"start", level, id, attempt, practice, dual, platformer, playback, wall_ms, x, y, lt, step, from, cps, hold}
//        lt = level time at the start (s; > 0 when a practice attempt starts at a checkpoint), step = m_currentStep,
//        from = the tick (round(lt x 240)) of the checkpoint it starts from (-1: the level's start), cps = checkpoints in the list,
//        hold = the jump button was down as the attempt began
//   {"t":"cp", n, id, lt, x, y, via}          a practice checkpoint stored (id = its tick, lt = the level time it restores to)
//   {"t":"cpdel", n, id}  /  {"t":"cpclear", n}   a checkpoint removed (the delete key) / all removed
//   {"t":"tick", n, step, lt, p:[x,y,vy,mode,up,ground,size,speed,px,py], p2:[...] (dual only), cam:[x,y]}
//   {"t":"btn", n, down, button, p1}          a press / release made after n ticks: it acts in tick n+1
//   {"t":"death", n, obj, ox, oy, x, y}       obj = the id of what killed (-1 unknown)
//   {"t":"end", n, result}                    result: death | complete | reset | quit
// n counts processCommands calls since the attempt started (GD's 240 Hz physics steps).
//
// Playback (GEODE.md "Playback"): a command file <mod save dir>/play.json, written by `node tools/probe.js play`:
//   {"level": "<name of a level in Create>", "autostart": true, "attempts": 1, "quit": true, "offset": 0,
//    "presses": [[tick, down 1/0, p2 0/1], ...]}   or a batch: {"autostart", "quit", "entries": [{level, attempts,
//    offset, presses}, ...]}: after each entry GD leaves the level and opens the next; one line per entry goes to
//    play.results.jsonl, and play.finished.json is written after the last.
// It is read once, when the main menu first shows, and renamed play.taken.json (one shot: a later normal start
// of GD plays nothing). autostart opens the level from the menu. In that level a press with tick T is made right
// before the processCommands call that runs once n == T + offset ticks are done -- the same n as the log's btn
// lines, so a logged attempt played back gives the same log. The user's own presses are ignored during playback.
// After `attempts` attempts (or a complete) it stops and writes play.finished.json; quit exits GD WITHOUT saving
// (the save stays as it was). Playback runs only for levels whose name starts with "GDLM".
//
// Rule from CLAUDE.md "Never slow the user's game": nothing here does I/O during the user's play. Ticks go into a
// string in memory; the file is written on a background thread when the attempt ends (at once for playback).

#include <Geode/Geode.hpp>
#include <Geode/modify/GJBaseGameLayer.hpp>
#include <Geode/modify/PlayLayer.hpp>
#include <Geode/modify/MenuLayer.hpp>
#include <Geode/modify/EditLevelLayer.hpp>

#include <array>
#include <chrono>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <thread>
#include <vector>

using namespace geode::prelude;

namespace {

struct Attempt {
    bool active = false;
    bool dead = false;
    long long n = 0;
    std::string buf;
    std::string file;
    void* lastCp = nullptr;   // the newest checkpoint already in the log (by pointer: m_uniqueID reads 0 on 2.2091)
};

Attempt g_att;
int g_seq = 0;

struct Play {
    bool loaded = false;      // a command file was read
    bool active = false;      // playing the current attempt
    bool done = false;
    bool inject = false;      // true while we call handleButton ourselves
    std::string level;
    bool autostart = false, quit = false;
    int attempts = 1, offset = 0, started = 0;
    size_t idx = 0;
    std::vector<std::array<int, 3>> presses;
};
struct Entry {
    std::string level;
    int attempts = 1, offset = 0;
    std::vector<std::array<int, 3>> presses;
};
Play g_play;
std::vector<Entry> g_entries;  // the batch; g_play holds the current one
size_t g_entry = 0;
bool g_openNext = false;       // the next entry opens when the level's edit page shows
bool g_menuSeen = false;

long long wallMs() {
    using namespace std::chrono;
    return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

std::string esc(std::string const& s) {
    std::string o;
    for (char c : s) {
        if (c == '"' || c == '\\') { o += '\\'; o += c; }
        else if (static_cast<unsigned char>(c) < 0x20) o += ' ';
        else o += c;
    }
    return o;
}

std::string safeName(std::string const& s) {
    std::string o;
    for (char c : s) o += (std::isalnum(static_cast<unsigned char>(c)) ? c : '_');
    if (o.size() > 40) o.resize(40);
    return o;
}

char const* modeOf(PlayerObject* p) {
    if (p->m_isShip) return "ship";
    if (p->m_isBird) return "ufo";
    if (p->m_isBall) return "ball";
    if (p->m_isDart) return "wave";
    if (p->m_isRobot) return "robot";
    if (p->m_isSpider) return "spider";
    if (p->m_isSwing) return "swing";
    return "cube";
}

void appendPlayer(std::string& out, PlayerObject* p) {
    char b[256];
    // x, y: m_position (the drawn position: in 2.2091 it moves once per 60 fps frame, 1-2 steps behind);
    // px, py (last two): GameObject's m_positionX / m_positionY doubles, the physics position of this step
    std::snprintf(b, sizeof b, "[%.4f,%.4f,%.5f,\"%s\",%d,%d,%.3f,%.4f,%.4f,%.4f]",
        p->m_position.x, p->m_position.y, p->m_yVelocity, modeOf(p),
        p->m_isUpsideDown ? 1 : 0, p->m_isOnGround ? 1 : 0, p->m_vehicleSize, p->m_playerSpeed,
        p->m_positionX, p->m_positionY);
    out += b;
}

bool wanted(PlayLayer* pl) {
    if (!Mod::get()->getSettingValue<bool>("enabled")) return false;
    if (!pl || !pl->m_level) return false;
    if (Mod::get()->getSettingValue<bool>("only-gdlm")) {
        std::string name = pl->m_level->m_levelName;
        if (name.rfind("GDLM", 0) != 0) return false;
    }
    return true;
}

std::filesystem::path saveDir() {
    return std::filesystem::path(Mod::get()->getSaveDir().string());
}

void writeFile(std::string const& data, std::string const& file) {
    std::error_code ec;
    std::filesystem::path path = std::filesystem::path(file);
    std::filesystem::create_directories(path.parent_path(), ec);
    std::ofstream f(path, std::ios::binary);
    f << data;
}

void finishPlayback(std::string const& result) {
    g_play.active = false;
    if (g_play.done) return;
    bool last = g_play.started >= g_play.attempts || result == "complete" || result == "quit" || result == "missing";
    if (!last) return;
    g_play.done = true;
    {
        std::ofstream f(saveDir() / "play.results.jsonl", std::ios::binary | std::ios::app);
        f << fmt::format("{{\"entry\":{},\"level\":\"{}\",\"attempts\":{},\"last\":\"{}\",\"wall_ms\":{}}}\n",
            g_entry, esc(g_play.level), g_play.started, result, wallMs());
    }
    if (g_entry + 1 < g_entries.size()) {
        // the next level: leave this one (to its edit page), open the next from there
        auto const& e = g_entries[++g_entry];
        g_play.level = e.level; g_play.attempts = e.attempts; g_play.offset = e.offset; g_play.presses = e.presses;
        g_play.started = 0; g_play.idx = 0; g_play.done = false;
        g_openNext = true;
        Loader::get()->queueInMainThread([] { if (auto* pl = PlayLayer::get()) pl->onQuit(); });
        return;
    }
    writeFile(fmt::format("{{\"level\":\"{}\",\"entries\":{},\"last\":\"{}\",\"wall_ms\":{}}}\n",
        esc(g_play.level), g_entries.size(), result, wallMs()), (saveDir() / "play.finished.json").string());
    if (g_play.quit) {
        // after the end screen / death effect has had a moment; exit without saving GD's data
        Loader::get()->queueInMainThread([] { geode::utils::game::exit(false); });
    }
}

void flush(char const* result) {
    if (!g_att.active) return;
    bool playback = g_play.active;
    char b[96];
    std::snprintf(b, sizeof b, "{\"t\":\"end\",\"n\":%lld,\"result\":\"%s\"}\n", g_att.n, result);
    g_att.buf += b;
    std::string data = std::move(g_att.buf);
    std::string file = g_att.file;
    g_att = Attempt{};
    if (playback) {
        // nobody is playing, and quit may follow right away: write it now
        writeFile(data, file);
        finishPlayback(result);
    } else {
        std::thread([data = std::move(data), file]() { writeFile(data, file); }).detach();
    }
}

void loadPlay() {
    auto file = saveDir() / "play.json";
    std::error_code ec;
    if (!std::filesystem::exists(file, ec)) return;
    std::string text;
    {
        std::ifstream f(file, std::ios::binary);
        text.assign(std::istreambuf_iterator<char>(f), std::istreambuf_iterator<char>());
    }
    std::filesystem::rename(file, saveDir() / "play.taken.json", ec);
    auto res = matjson::parse(text);
    if (!res) { log::warn("gdlm probe: play.json does not parse"); return; }
    auto j = res.unwrap();
    g_play = Play{};
    g_play.level = j["level"].asString().unwrapOr("");
    g_play.autostart = j["autostart"].asBool().unwrapOr(false);
    g_play.quit = j["quit"].asBool().unwrapOr(false);
    // one entry at the top level, or a batch: "entries": [{level, attempts, offset, presses}, ...]
    auto readEntry = [](matjson::Value& v) {
        Entry e;
        e.level = v["level"].asString().unwrapOr("");
        e.attempts = static_cast<int>(v["attempts"].asInt().unwrapOr(1));
        e.offset = static_cast<int>(v["offset"].asInt().unwrapOr(0));
        if (v["presses"].isArray()) {
            for (auto& p : v["presses"]) {
                e.presses.push_back({static_cast<int>(p[0].asInt().unwrapOr(0)),
                    static_cast<int>(p[1].asInt().unwrapOr(0)), static_cast<int>(p[2].asInt().unwrapOr(0))});
            }
        }
        return e;
    };
    g_entries.clear();
    g_entry = 0;
    if (j["entries"].isArray()) {
        for (auto& v : j["entries"]) {
            auto e = readEntry(v);
            if (e.level.rfind("GDLM", 0) == 0) g_entries.push_back(std::move(e));
        }
    } else {
        auto e = readEntry(j);
        if (e.level.rfind("GDLM", 0) == 0) g_entries.push_back(std::move(e));
    }
    g_play.loaded = !g_entries.empty();
    if (g_play.loaded) {
        auto const& e = g_entries[0];
        g_play.level = e.level; g_play.attempts = e.attempts; g_play.offset = e.offset; g_play.presses = e.presses;
    }
    std::error_code ec2;
    std::filesystem::remove(saveDir() / "play.results.jsonl", ec2);
    log::info("gdlm probe: play.json with {} GDLM entries", g_entries.size());
}

void openPlayLevel() {
    auto* llm = LocalLevelManager::get();
    if (!llm || !llm->m_localLevels) return;
    for (auto* lvl : CCArrayExt<GJGameLevel*>(llm->m_localLevels)) {
        if (lvl && std::string(lvl->m_levelName) == g_play.level) {
            log::info("gdlm probe: opening '{}'", g_play.level);
            auto* scene = PlayLayer::scene(lvl, false);
            CCDirector::get()->replaceScene(CCTransitionFade::create(0.5f, scene));
            return;
        }
    }
    log::warn("gdlm probe: no local level named '{}'", g_play.level);
    // skip it: record it and go on with the next entry (or end the batch)
    g_play.started = 0;
    finishPlayback("missing");
    if (g_openNext) { g_openNext = false; Loader::get()->queueInMainThread([] { openPlayLevel(); }); }
}

CheckpointObject* lastCheckpoint(PlayLayer* pl) {
    if (!pl || !pl->m_checkpointArray || pl->m_checkpointArray->count() == 0) return nullptr;
    return static_cast<CheckpointObject*>(pl->m_checkpointArray->lastObject());
}
// a checkpoint's id in the logs = its tick, round(level time x 240): CheckpointObject::m_uniqueID reads 0 for every
// checkpoint on GD 2.2091 (Clubstep practice, 2026-11-25), so it cannot tell them apart
int cpTick(CheckpointObject* cp) {
    return cp ? static_cast<int>(cp->m_gameState.m_levelTime * 240.0 + 0.5) : -1;
}
int lastCheckpointId(PlayLayer* pl) { return cpTick(lastCheckpoint(pl)); }

void logCheckpoint(CheckpointObject* cp, char const* via) {
    if (!g_att.active || !cp || cp == g_att.lastCp) return;
    g_att.lastCp = cp;
    float x = 0.f, y = 0.f;
    if (cp->m_player1Checkpoint) { x = cp->m_player1Checkpoint->m_position.x; y = cp->m_player1Checkpoint->m_position.y; }
    char b[224];
    std::snprintf(b, sizeof b, "{\"t\":\"cp\",\"n\":%lld,\"id\":%d,\"lt\":%.6f,\"x\":%.4f,\"y\":%.4f,\"via\":\"%s\"}\n",
        g_att.n, cpTick(cp), cp->m_gameState.m_levelTime, x, y, via);
    g_att.buf += b;
}

void begin(PlayLayer* pl) {
    if (g_att.active) flush("reset");
    g_play.active = false;
    if (g_play.loaded && !g_play.done && pl && pl->m_level && std::string(pl->m_level->m_levelName) == g_play.level) {
        g_play.active = true;
        g_play.idx = 0;
        g_play.started++;
    }
    if (!wanted(pl) && !g_play.active) return;
    g_att.active = true;
    g_att.n = 0;
    g_att.lastCp = lastCheckpoint(pl);
    std::string name = pl->m_level->m_levelName;
    long long ms = wallMs();
    auto dir = saveDir() / "attempts";
    g_att.file = (dir / fmt::format("{}_{}_{}.jsonl", ms, safeName(name), g_seq++)).string();
    auto* p = pl->m_player1;
    int held = 0;
    if (p) { auto it = p->m_holdingButtons.find(1); held = (it != p->m_holdingButtons.end() && it->second) ? 1 : 0; }
    char b[640];
    std::snprintf(b, sizeof b,
        "{\"t\":\"start\",\"level\":\"%s\",\"id\":%d,\"attempt\":%d,\"practice\":%d,\"dual\":%d,"
        "\"platformer\":%d,\"playback\":%d,\"wall_ms\":%lld,\"x\":%.4f,\"y\":%.4f,"
        "\"lt\":%.6f,\"step\":%d,\"from\":%d,\"cps\":%d,\"hold\":%d}\n",
        esc(name).c_str(), static_cast<int>(pl->m_level->m_levelID.value()), pl->m_attempts,
        pl->m_isPracticeMode ? 1 : 0, pl->m_gameState.m_isDualMode ? 1 : 0, p && p->m_isPlatformer ? 1 : 0,
        g_play.active ? 1 : 0, ms, p ? p->m_position.x : 0.f, p ? p->m_position.y : 0.f,
        pl->m_gameState.m_levelTime, pl->m_currentStep, lastCheckpointId(pl),
        pl->m_checkpointArray ? static_cast<int>(pl->m_checkpointArray->count()) : 0, held);
    g_att.buf.reserve(1 << 20);
    g_att.buf += b;
}

} // namespace

class $modify(ProbeBase, GJBaseGameLayer) {
    void processCommands(float dt, bool isHalfTick, bool isLastTick) {
        auto* pl = PlayLayer::get();
        bool ours = pl && static_cast<GJBaseGameLayer*>(pl) == this;
        if (ours && g_play.active && g_att.active && !g_att.dead) {
            auto& ps = g_play.presses;
            while (g_play.idx < ps.size() && ps[g_play.idx][0] + g_play.offset <= g_att.n) {
                auto const& e = ps[g_play.idx++];
                g_play.inject = true;
                this->handleButton(e[1] != 0, 1, e[2] == 0);
                g_play.inject = false;
            }
        }
        GJBaseGameLayer::processCommands(dt, isHalfTick, isLastTick);
        if (!ours) return;
        if (!g_att.active || g_att.dead) return;
        g_att.n++;
        std::string& o = g_att.buf;
        char b[160];
        std::snprintf(b, sizeof b, "{\"t\":\"tick\",\"n\":%lld,\"step\":%d,\"lt\":%.6f,\"p\":",
            g_att.n, m_currentStep, m_gameState.m_levelTime);
        o += b;
        appendPlayer(o, m_player1);
        if (m_gameState.m_isDualMode && m_player2) { o += ",\"p2\":"; appendPlayer(o, m_player2); }
        std::snprintf(b, sizeof b, ",\"cam\":[%.3f,%.3f]}\n",
            m_gameState.m_cameraPosition.x, m_gameState.m_cameraPosition.y);
        o += b;
        // a checkpoint stored where the storeCheckpoint hook did not see it (an inlined call): caught on the next tick
        if (pl->m_isPracticeMode && pl->m_checkpointArray && pl->m_checkpointArray->count() > 0) {
            auto* cp = static_cast<CheckpointObject*>(pl->m_checkpointArray->lastObject());
            if (cp && cp != g_att.lastCp) logCheckpoint(cp, "tick");
        }
    }

    void handleButton(bool down, int button, bool isPlayer1) {
        auto* pl = PlayLayer::get();
        bool ours = pl && static_cast<GJBaseGameLayer*>(pl) == this;
        // during playback only our own presses go through (the user's would change the route)
        if (ours && g_play.active && !g_play.inject) return;
        GJBaseGameLayer::handleButton(down, button, isPlayer1);
        if (!ours || !g_att.active) return;
        char b[128];
        std::snprintf(b, sizeof b, "{\"t\":\"btn\",\"n\":%lld,\"down\":%d,\"button\":%d,\"p1\":%d}\n",
            g_att.n, down ? 1 : 0, button, isPlayer1 ? 1 : 0);
        g_att.buf += b;
    }
};

class $modify(ProbePlay, PlayLayer) {
    void resetLevel() {
        PlayLayer::resetLevel();
        begin(this);
    }

    void destroyPlayer(PlayerObject* player, GameObject* object) {
        PlayLayer::destroyPlayer(player, object);
        // GD also calls this with its anti-cheat object at the start; only a real death sets m_isDead.
        if (!g_att.active || g_att.dead || !player || !player->m_isDead) return;
        char b[256];
        std::snprintf(b, sizeof b,
            "{\"t\":\"death\",\"n\":%lld,\"obj\":%d,\"ox\":%.3f,\"oy\":%.3f,\"x\":%.4f,\"y\":%.4f}\n",
            g_att.n, object ? object->m_objectID : -1, object ? object->getPositionX() : 0.f,
            object ? object->getPositionY() : 0.f, player->m_position.x, player->m_position.y);
        g_att.buf += b;
        g_att.dead = true;
        flush("death");
    }

    // GD pauses a level when its window loses focus; a playback must not stop because the user works in another window
    void pauseGame(bool unfocused) {
        if (unfocused && g_play.loaded && !g_play.done) return;
        PlayLayer::pauseGame(unfocused);
    }

    // practice checkpoints, for tools/stitch.js (a full run from practice attempts): which checkpoint each attempt
    // reached and placed; the checkpoint's own level time is what a respawn restores
    void storeCheckpoint(CheckpointObject* cp) {
        PlayLayer::storeCheckpoint(cp);
        logCheckpoint(cp, "store");
    }

    void removeCheckpoint(bool first) {
        int id = -1;
        if (m_checkpointArray && m_checkpointArray->count() > 0) {
            auto* cp = static_cast<CheckpointObject*>(first ? m_checkpointArray->objectAtIndex(0) : m_checkpointArray->lastObject());
            if (cp) id = cpTick(cp);
        }
        PlayLayer::removeCheckpoint(first);
        if (!g_att.active) return;
        g_att.lastCp = lastCheckpoint(this);   // the one now last was logged when it was stored
        char b[96];
        std::snprintf(b, sizeof b, "{\"t\":\"cpdel\",\"n\":%lld,\"id\":%d}\n", g_att.n, id);
        g_att.buf += b;
    }

    void removeAllCheckpoints() {
        PlayLayer::removeAllCheckpoints();
        if (!g_att.active) return;
        g_att.lastCp = nullptr;
        char b[64];
        std::snprintf(b, sizeof b, "{\"t\":\"cpclear\",\"n\":%lld}\n", g_att.n);
        g_att.buf += b;
    }

    void levelComplete() {
        flush("complete");
        PlayLayer::levelComplete();
    }

    void onQuit() {
        flush("quit");
        PlayLayer::onQuit();
    }
};

class $modify(ProbeMenu, MenuLayer) {
    bool init() {
        if (!MenuLayer::init()) return false;
        if (!g_menuSeen) {
            g_menuSeen = true;
            loadPlay();
            if (g_play.loaded && g_play.autostart) {
                Loader::get()->queueInMainThread([] { openPlayLevel(); });
            }
        }
        return true;
    }
};

class $modify(ProbeEdit, EditLevelLayer) {
    bool init(GJGameLevel* level) {
        if (!EditLevelLayer::init(level)) return false;
        // a batch left the previous level: open the next one
        if (g_openNext) {
            g_openNext = false;
            Loader::get()->queueInMainThread([] { openPlayLevel(); });
        }
        return true;
    }
};
