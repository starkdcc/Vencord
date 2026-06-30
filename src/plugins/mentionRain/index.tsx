/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

// rain on mentions lol
// first tried css keyframes but you cant trigger them on a flux event, canvas it is

type Droplet = { x: number; y: number; vy: number; len: number; alpha: number; w: number };
type Bounce = { x: number; y: number; vx: number; vy: number; life: number };

const settings = definePluginSettings({
    drops: {
        type: OptionType.NUMBER,
        description: "how many drops",
        default: 80
    },
    seconds: {
        type: OptionType.SLIDER,
        description: "how long it rians",
        markers: [1, 2, 3, 5],
        default: 3,
        stickToMarkers: true
    },
    color: {
        type: OptionType.STRING,
        description: "drop color (css)",
        default: "rgba(170, 215, 255, 0.85)"
    }
    // TODO: maybe a thunder sound? idk if anyone wants that
});

const WIND = 0.4; // pixels per frame slant, 0.4 looks right honestly idk
const BOUNCE_LIFE = 600;

let sky: HTMLCanvasElement | null = null;
let loopId = 0;
let stopAt = 0;

// const HERO_RATIO = 0.08; // tried big foreground drops, looked too much

function makeDroplet(width: number, height: number): Droplet {
    const depth = Math.random();
    const speed = (5 + Math.random() * 9) * (0.5 + depth);
    return {
        x: Math.random() * width,
        y: Math.random() * height - height * 0.5,
        vy: speed,
        len: (8 + Math.random() * 18) * (0.4 + depth),
        alpha: (0.3 + Math.random() * 0.7) * (0.4 + depth * 0.6),
        w: 0.8 + depth * 1.2
    };
}

function makeBounce(x: number, groundY: number): Bounce {
    return {
        x,
        y: groundY - 4,
        vx: (Math.random() - 0.5) * 3,
        vy: -1.5 - Math.random() * 2,
        life: BOUNCE_LIFE
    };
}

function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, fade: number) {
    ctx.fillStyle = `rgba(0,10,30,${0.1 * fade})`;
    ctx.fillRect(0, 0, w, h);
}

function startShower() {
    if (sky) {
        // already raining, just push the deadline back
        stopAt = performance.now() + settings.store.seconds * 1000;
        return;
    }

    sky = document.createElement("canvas");
    sky.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999";
    sky.width = window.innerWidth;
    sky.height = window.innerHeight;
    document.body.appendChild(sky);

    const ctx = sky.getContext("2d");
    if (!ctx) { stopShower(); return; }

    const { drops: count, seconds, color } = settings.store;
    stopAt = performance.now() + seconds * 1000;

    const droplets = Array.from({ length: count }, () => makeDroplet(sky!.width, sky!.height));
    const bounces: Bounce[] = [];

    function paint() {
        if (!sky || !ctx) return;
        const now = performance.now();
        const remaining = stopAt - now;
        const fade = remaining < 500 ? Math.max(0, remaining / 500) : 1;

        ctx.clearRect(0, 0, sky.width, sky.height);
        paintBackdrop(ctx, sky.width, sky.height, fade);

        ctx.lineCap = "round";
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;

        for (const d of droplets) {
            ctx.globalAlpha = d.alpha * fade;
            ctx.lineWidth = d.w;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - WIND, d.y - d.len);
            ctx.stroke();

            d.x -= WIND;
            d.y += d.vy;

            if (d.y > sky.height) {
                if (Math.random() < 0.5) bounces.push(makeBounce(d.x, sky.height));
                d.y = -d.len;
                d.x = Math.random() * sky.width;
            }
        }

        ctx.fillStyle = color;
        ctx.shadowBlur = 3;

        const alive: Bounce[] = [];
        for (const b of bounces) {
            b.life -= 16;
            if (b.life <= 0) continue;
            b.vy += 0.18;
            b.x += b.vx;
            b.y += b.vy;
            ctx.globalAlpha = (b.life / BOUNCE_LIFE) * fade;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 1.3, 0, 6.283);
            ctx.fill();
            alive.push(b);
        }
        bounces.length = 0;
        bounces.push(...alive);

        if (remaining > 0 || bounces.length) loopId = requestAnimationFrame(paint);
        else stopShower();
    }

    loopId = requestAnimationFrame(paint);
}

function stopShower() {
    if (loopId) cancelAnimationFrame(loopId);
    if (sky) sky.remove();
    sky = null;
    loopId = 0;
}

const handleResize = () => {
    if (!sky) return;
    sky.width = window.innerWidth;
    sky.height = window.innerHeight;
};

function mentionsMe(payload: { message: { author?: { id: string }; mentions?: { id: string }[] } }) {
    const self = UserStore.getCurrentUser();
    if (!self) return false;
    if (payload.message.author?.id === self.id) return false;
    return payload.message.mentions?.some(m => m.id === self.id) ?? false;
}

function onMessageFlux(payload: { message: { author?: { id: string }; mentions?: { id: string }[] } }) {
    if (mentionsMe(payload)) startShower();
}

export default definePlugin({
    name: "MentionRain",
    description: "rain falls on your screen when someone pings you",
    authors: [{ name: "stark", id: 0n }],
    settings,

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageFlux);
        window.addEventListener("resize", handleResize);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageFlux);
        window.removeEventListener("resize", handleResize);
        stopShower();
    }
});
