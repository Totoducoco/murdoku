import Phaser from "phaser";
import { DIFFICULTY_PROFILES, type MurdokuDifficulty } from "./MenuScene";

const WIDTH = 1440;
const HEIGHT = 960;

type ResultData = {
    difficulty?: MurdokuDifficulty;
    caseId?: string;
    clueCount?: number;
    elapsedSeconds?: number;
    murdererName?: string;
};

export default class ResultScene extends Phaser.Scene {
    private resultData!: ResultData;

    constructor() {
        super("ResultScene");
    }

    init(data: ResultData): void {
        this.resultData = data ?? {};
    }

    create(): void {
        const difficulty = this.resultData.difficulty ?? "normal";
        const profile = DIFFICULTY_PROFILES[difficulty];
        const graphics = this.add.graphics();
        graphics.fillStyle(0x0b1020, 1);
        graphics.fillRect(0, 0, WIDTH, HEIGHT);
        graphics.fillStyle(0x1a2d40, 0.38);
        graphics.fillCircle(720, 300, 300);
        graphics.lineStyle(1, 0x2b3b58, 0.2);
        for (let x = 0; x < WIDTH; x += 64) graphics.lineBetween(x, 0, x, HEIGHT);
        for (let y = 0; y < HEIGHT; y += 64) graphics.lineBetween(0, y, WIDTH, y);

        this.add.rectangle(WIDTH / 2, 470, 660, 610, 0x151f32, 1)
            .setStrokeStyle(1, 0x3b4e70, 1);

        this.add.text(WIDTH / 2, 235, "AFFAIRE RÉSOLUE", {
            fontFamily: "Arial",
            fontSize: "38px",
            fontStyle: "bold",
            color: "#f3f6fb",
            letterSpacing: 2
        }).setOrigin(0.5);

        this.add.circle(WIDTH / 2, 330, 42, profile.accent, 0.16)
            .setStrokeStyle(2, profile.accent, 0.9);
        this.add.text(WIDTH / 2, 330, "✓", {
            fontFamily: "Arial",
            fontSize: "42px",
            color: profile.accentHex,
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(WIDTH / 2, 415, "Bien joué, enquêteur !", {
            fontFamily: "Arial",
            fontSize: "26px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(WIDTH / 2, 470, `Le coupable était ${this.resultData.murdererName ?? "identifié"}.`, {
            fontFamily: "Arial",
            fontSize: "17px",
            color: "#c6d2e7"
        }).setOrigin(0.5);

        const time = this.formatTime(this.resultData.elapsedSeconds ?? 0);
        const stats = [
            { label: "DOSSIER", value: this.resultData.caseId ?? "—" },
            { label: "NIVEAU", value: profile.label },
            { label: "INDICES", value: String(this.resultData.clueCount ?? 0) },
            { label: "TEMPS", value: time }
        ];
        const startX = WIDTH / 2 - 270;
        stats.forEach((stat, index) => {
            const x = startX + index * 180;
            this.add.text(x + 75, 555, stat.label, {
                fontFamily: "Arial",
                fontSize: "10px",
                color: "#8393ad",
                fontStyle: "bold",
                letterSpacing: 1
            }).setOrigin(0.5);
            this.add.text(x + 75, 585, stat.value, {
                fontFamily: "Arial",
                fontSize: "15px",
                color: "#edf2fb",
                fontStyle: "bold"
            }).setOrigin(0.5);
        });

        this.add.text(WIDTH / 2, 650, "Une seule solution. Une enquête bien menée.", {
            fontFamily: "Arial",
            fontSize: "13px",
            color: "#8e9bb2"
        }).setOrigin(0.5);

        this.makeButton(WIDTH / 2 - 220, 720, 205, 52, "REJOUER", profile.accent,
            () => this.scene.start("GameScene", { difficulty }));
        this.makeButton(WIDTH / 2 + 15, 720, 205, 52, "MENU PRINCIPAL", 0x60718f,
            () => this.scene.start("MenuScene"));
    }

    private makeButton(
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        color: number,
        callback: () => void
    ): void {
        const bg = this.add.rectangle(x + width / 2, y + height / 2, width, height, color, 0.95)
            .setStrokeStyle(1, color, 1)
            .setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setAlpha(0.8));
        bg.on("pointerout", () => bg.setAlpha(0.95));
        bg.on("pointerdown", callback);
        this.add.text(x + width / 2, y + height / 2, label, {
            fontFamily: "Arial",
            fontSize: "13px",
            fontStyle: "bold",
            color: "#101827",
            letterSpacing: 0.5
        }).setOrigin(0.5);
    }

    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
}
