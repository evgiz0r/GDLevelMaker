// GDLM Probe: logs the player's state on every physics tick and every press, one JSON-lines file per attempt.
// Read-only: it never changes the game. Files go to the mod's save folder
// (<GD save dir>/geode/mods/gdlm.probe/attempts/). Read them with tools/probe.js (GEODE.md).
//
// Line types (all one JSON object per line):
//   {"t":"start", level, id, attempt, practice, dual, platformer, wall_ms, x, y}
//   {"t":"tick", n, step, lt, p:[x,y,vy,mode,up,ground,size,speed], p2:[...] (dual only), cam:[x,y]}
//   {"t":"btn", n, down, button, p1}          a press / release, applied during tick n
//   {"t":"death", n, obj, ox, oy, x, y}       obj = the id of what killed (-1 unknown)
//   {"t":"end", n, result}                    result: death | complete | reset | quit
// n counts processCommands calls since the attempt started (GD's 240 Hz physics steps).
//
// Rule from CLAUDE.md "Never slow the user's game": nothing here does I/O during play. Ticks go into a
// string in memory; the file is written on a background thread when the attempt ends.

#include <Geode/Geode.hpp>
#include <Geode/modify/GJBaseGameLayer.hpp>
#include <Geode/modify/PlayLayer.hpp>

#include <chrono>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <string>
#include <thread>

using namespace geode::prelude;

namespace {

struct Attempt {
    bool active = false;
    bool dead = false;
    long long n = 0;
    std::string buf;
    std::string file;
};

Attempt g_att;
int g_seq = 0;

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
    std::snprintf(b, sizeof b, "[%.4f,%.4f,%.5f,\"%s\",%d,%d,%.3f,%.4f]",
        p->m_position.x, p->m_position.y, p->m_yVelocity, modeOf(p),
        p->m_isUpsideDown ? 1 : 0, p->m_isOnGround ? 1 : 0, p->m_vehicleSize, p->m_playerSpeed);
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

void flush(char const* result) {
    if (!g_att.active) return;
    char b[96];
    std::snprintf(b, sizeof b, "{\"t\":\"end\",\"n\":%lld,\"result\":\"%s\"}\n", g_att.n, result);
    g_att.buf += b;
    std::string data = std::move(g_att.buf);
    std::string file = g_att.file;
    g_att = Attempt{};
    std::thread([data = std::move(data), file]() {
        std::error_code ec;
        std::filesystem::path path = std::filesystem::path(file);
        std::filesystem::create_directories(path.parent_path(), ec);
        std::ofstream f(path, std::ios::binary);
        f << data;
    }).detach();
}

void begin(PlayLayer* pl) {
    if (g_att.active) flush("reset");
    if (!wanted(pl)) return;
    g_att.active = true;
    g_att.n = 0;
    std::string name = pl->m_level->m_levelName;
    long long ms = wallMs();
    auto dir = Mod::get()->getSaveDir() / "attempts";
    g_att.file = (dir / fmt::format("{}_{}_{}.jsonl", ms, safeName(name), g_seq++)).string();
    auto* p = pl->m_player1;
    char b[512];
    std::snprintf(b, sizeof b,
        "{\"t\":\"start\",\"level\":\"%s\",\"id\":%d,\"attempt\":%d,\"practice\":%d,\"dual\":%d,"
        "\"platformer\":%d,\"wall_ms\":%lld,\"x\":%.4f,\"y\":%.4f}\n",
        esc(name).c_str(), static_cast<int>(pl->m_level->m_levelID.value()), pl->m_attempts,
        pl->m_isPracticeMode ? 1 : 0, pl->m_gameState.m_isDualMode ? 1 : 0, p && p->m_isPlatformer ? 1 : 0,
        ms, p ? p->m_position.x : 0.f, p ? p->m_position.y : 0.f);
    g_att.buf.reserve(1 << 20);
    g_att.buf += b;
}

} // namespace

class $modify(ProbeBase, GJBaseGameLayer) {
    void processCommands(float dt, bool isHalfTick, bool isLastTick) {
        GJBaseGameLayer::processCommands(dt, isHalfTick, isLastTick);
        auto* pl = PlayLayer::get();
        if (!pl || static_cast<GJBaseGameLayer*>(pl) != this) return;
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
    }

    void handleButton(bool down, int button, bool isPlayer1) {
        GJBaseGameLayer::handleButton(down, button, isPlayer1);
        auto* pl = PlayLayer::get();
        if (!pl || static_cast<GJBaseGameLayer*>(pl) != this || !g_att.active) return;
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

    void levelComplete() {
        flush("complete");
        PlayLayer::levelComplete();
    }

    void onQuit() {
        flush("quit");
        PlayLayer::onQuit();
    }
};
