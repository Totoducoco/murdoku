import Phaser from "phaser";
import { DIFFICULTY_PROFILES, type MurdokuDifficulty } from "./MenuScene";

const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 960;

type ResultData = {
    difficulty?: MurdokuDifficulty;
    caseId?: string;
    clueCount?: number;
    elapsedSeconds?: number;
    murdererName?: string;
};

export default class ResultScene extends Phaser.Scene {
    private resultData!: ResultData;
    private container?: Phaser.GameObjects.Container;

    constructor() {
        super("ResultScene");
    }

    init(data: ResultData): void {
        this.resultData = data ?? {};
    }

    create(): void {
        this.scale.on("resize", this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off("resize", this.handleResize, this);
        });
        this.draw();
    }

    private handleResize(): void {
        this.draw();
    }

    private draw(): void {
        this.container?.destroy(true);
        const container = this.add.container(0, 0);
        this.container = container;

        if (this.scale.width < 900 || this.scale.height < 650) {
            this.drawMobile(container);
        } else {
            this.drawDesktop(container);
            const scale = Math.min(this.scale.width / DESIGN_WIDTH, this.scale.height / DESIGN_HEIGHT, 1);
            container.setScale(scale);
            container.setPosition(
                (this.scale.width - DESIGN_WIDTH * scale) / 2,
                (this.scale.height - DESIGN_HEIGHT * scale) / 2
            );
        }
    }

    private drawBackground(container: Phaser.GameObjects.Container, width: number, height: number): void {
        const graphics = this.add.graphics();
        graphics.fillStyle(0x0b1020, 1);
        graphics.fillRect(0, 0, width, height);
        graphics.fillStyle(0x1a2d40, 0.38);
        graphics.fillCircle(width / 2, height * 0.35, Math.min(width * 0.75, 300));
        graphics.lineStyle(1, 0x2b3b58, 0.2);
        for (let x = 0; x < width; x += 48) graphics.lineBetween(x, 0, x, height);
        for (let y = 0; y < height; y += 48) graphics.lineBetween(0, y, width, y);
        container.add(graphics);
    }

    private drawDesktop(container: Phaser.GameObjects.Container): void {
        const difficulty = this.resultData.difficulty ?? "normal";
        const profile = DIFFICULTY_PROFILES[difficulty];
        this.drawBackground(container, DESIGN_WIDTH, DESIGN_HEIGHT);

        const card = this.add.rectangle(DESIGN_WIDTH / 2, 470, 660, 610, 0x151f32, 1)
            .setStrokeStyle(1, 0x3b4e70, 1);
        container.add(card);

        this.addText(container, DESIGN_WIDTH / 2, 235, "AFFAIRE RÉSOLUE", 38, "#f3f6fb", true, 2).setOrigin(0.5);
        this.addCircle(container, DESIGN_WIDTH / 2, 330, 42, profile.accent, 0.16, profile.accent);
        this.addText(container, DESIGN_WIDTH / 2, 330, "✓", 42, profile.accentHex, true).setOrigin(0.5);
        this.addText(container, DESIGN_WIDTH / 2, 415, "Bien joué, enquêteur !", 26, "#ffffff", true).setOrigin(0.5);
        this.addText(container, DESIGN_WIDTH / 2, 470,
            `Le coupable était ${this.resultData.murdererName ?? "identifié"}.`,
            17, "#c6d2e7"
        ).setOrigin(0.5);

        const stats = this.getStats(profile.label);
        const startX = DESIGN_WIDTH / 2 - 270;
        stats.forEach((stat, index) => {
            const x = startX + index * 180;
            this.addText(container, x + 75, 555, stat.label, 10, "#8393ad", true, 1).setOrigin(0.5);
            this.addText(container, x + 75, 585, stat.value, 15, "#edf2fb", true).setOrigin(0.5);
        });

        this.addText(container, DESIGN_WIDTH / 2, 650, "Une seule solution. Une enquête bien menée.", 13, "#8e9bb2").setOrigin(0.5);
        this.makeButton(container, DESIGN_WIDTH / 2 - 220, 720, 205, 52, "REJOUER", profile.accent,
            () => this.scene.start("GameScene", { difficulty }));
        this.makeButton(container, DESIGN_WIDTH / 2 + 15, 720, 205, 52, "MENU PRINCIPAL", 0x60718f,
            () => this.scene.start("MenuScene"));
    }

    private drawMobile(container: Phaser.GameObjects.Container): void {
        const width = this.scale.width;
        const height = this.scale.height;
        const difficulty = this.resultData.difficulty ?? "normal";
        const profile = DIFFICULTY_PROFILES[difficulty];
        this.drawBackground(container, width, height);

        const cardWidth = Math.min(width - 28, 520);
        const centerX = width / 2;
        const top = Math.max(18, (height - 650) / 2);
        const card = this.add.rectangle(centerX, height / 2, cardWidth, Math.min(height - 24, 650), 0x151f32, 1)
            .setStrokeStyle(1, 0x3b4e70, 1);
        container.add(card);

        this.addText(container, centerX, top + 48, "AFFAIRE RÉSOLUE", 25, "#f3f6fb", true, 1.5)
            .setOrigin(0.5);
        this.addCircle(container, centerX, top + 125, 35, profile.accent, 0.16, profile.accent);
        this.addText(container, centerX, top + 125, "✓", 36, profile.accentHex, true).setOrigin(0.5);
        this.addText(container, centerX, top + 190, "Bien joué, enquêteur !", 19, "#ffffff", true).setOrigin(0.5);
        this.addText(container, centerX, top + 230,
            `Le coupable était ${this.resultData.murdererName ?? "identifié"}.`,
            13, "#c6d2e7", true, 0, { align: "center", wordWrap: { width: cardWidth - 36 } }
        ).setOrigin(0.5);

        const stats = this.getStats(profile.label);
        const statY = top + 310;
        const statGap = 12;
        const statWidth = (cardWidth - 48 - statGap) / 2;
        stats.forEach((stat, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = centerX - statWidth - statGap / 2 + col * (statWidth + statGap);
            const y = statY + row * 82;
            const statCard = this.add.rectangle(x + statWidth / 2, y + 28, statWidth, 64, 0x202c43, 1)
                .setStrokeStyle(1, 0x354664, 1);
            container.add(statCard);
            this.addText(container, x + statWidth / 2, y + 14, stat.label, 9, "#8393ad", true, 0.8).setOrigin(0.5);
            this.addText(container, x + statWidth / 2, y + 40, stat.value, 14, "#edf2fb", true).setOrigin(0.5);
        });

        this.addText(container, centerX, top + 510, "Une seule solution. Une enquête bien menée.", 10, "#8e9bb2", false,
            0, { align: "center", wordWrap: { width: cardWidth - 28 } }).setOrigin(0.5);
        this.makeButton(container, centerX - (cardWidth - 36) / 2, top + 545, cardWidth - 36, 44,
            "REJOUER", profile.accent, () => this.scene.start("GameScene", { difficulty }));
        this.makeButton(container, centerX - (cardWidth - 36) / 2, top + 598, cardWidth - 36, 44,
            "MENU PRINCIPAL", 0x60718f, () => this.scene.start("MenuScene"));
    }

    private getStats(difficultyLabel: string): Array<{ label: string; value: string }> {
        return [
            { label: "DOSSIER", value: this.resultData.caseId ?? "—" },
            { label: "NIVEAU", value: difficultyLabel },
            { label: "INDICES", value: String(this.resultData.clueCount ?? 0) },
            { label: "TEMPS", value: this.formatTime(this.resultData.elapsedSeconds ?? 0) }
        ];
    }

    private addCircle(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        radius: number,
        fill: number,
        alpha: number,
        stroke: number
    ): void {
        const circle = this.add.circle(x, y, radius, fill, alpha).setStrokeStyle(2, stroke, 0.9);
        container.add(circle);
    }

    private addText(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        text: string,
        size: number,
        color: string,
        bold = false,
        letterSpacing = 0,
        extra: Phaser.Types.GameObjects.Text.TextStyle = {}
    ): Phaser.GameObjects.Text {
        const object = this.add.text(x, y, text, {
            fontFamily: "Arial, sans-serif",
            fontSize: `${size}px`,
            color,
            fontStyle: bold ? "bold" : "normal",
            letterSpacing,
            ...extra
        });
        container.add(object);
        return object;
    }

    private makeButton(
        container: Phaser.GameObjects.Container,
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
        container.add(bg);
        this.addText(container, x + width / 2, y + height / 2, label, 13, "#101827", true, 0.5)
            .setOrigin(0.5);
    }

    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
}
