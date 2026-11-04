import Phaser from "phaser";

export type MurdokuDifficulty = "easy" | "normal" | "hard" | "expert";

export type DifficultyProfile = {
    id: MurdokuDifficulty;
    label: string;
    subtitle: string;
    size: number;
    rooms: number;
    suspects: number;
    accent: number;
    accentHex: string;
    description: string;
};

export const DIFFICULTY_PROFILES: Record<MurdokuDifficulty, DifficultyProfile> = {
    easy: {
        id: "easy",
        label: "Facile",
        subtitle: "Pour commencer",
        size: 4,
        rooms: 3,
        suspects: 3,
        accent: 0x77c6a3,
        accentHex: "#77c6a3",
        description: "Petite grille, peu de suspects et des déductions accessibles."
    },
    normal: {
        id: "normal",
        label: "Normal",
        subtitle: "Un bon équilibre",
        size: 5,
        rooms: 4,
        suspects: 4,
        accent: 0x7da7f7,
        accentHex: "#7da7f7",
        description: "Davantage de pièces et de relations à croiser."
    },
    hard: {
        id: "hard",
        label: "Difficile",
        subtitle: "Pour les enquêteurs",
        size: 6,
        rooms: 5,
        suspects: 5,
        accent: 0xe5b86b,
        accentHex: "#e5b86b",
        description: "Une grille plus vaste et plus de suspects à départager."
    },
    expert: {
        id: "expert",
        label: "Expert",
        subtitle: "Aucune erreur permise",
        size: 7,
        rooms: 6,
        suspects: 6,
        accent: 0xc49af4,
        accentHex: "#c49af4",
        description: "Le plus grand plateau et le maximum de relations à analyser."
    }
};

const WIDTH = 1440;
const HEIGHT = 960;

export default class MenuScene extends Phaser.Scene {
    private selectedDifficulty: MurdokuDifficulty = "normal";
    private menuContainer?: Phaser.GameObjects.Container;

    constructor() {
        super("MenuScene");
    }

    create(): void {
        this.scale.on("resize", this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off("resize", this.handleResize, this);
        });
        this.drawMenu();
    }

    private handleResize(): void {
        this.drawMenu();
    }

    private isCompactLayout(): boolean {
        return this.scale.width < 900 || this.scale.height < 650;
    }

    private drawMenu(): void {
        if (this.isCompactLayout()) {
            this.drawMobileMenu();
            return;
        }
        this.menuContainer?.destroy(true);
        const container = this.add.container(0, 0);
        this.menuContainer = container;

        this.drawBackground(container);

        this.addText(container, WIDTH / 2, 112, "MURDOKU", {
            fontSize: "68px",
            fontStyle: "bold",
            color: "#f7f8fc",
            letterSpacing: 5
        }).setOrigin(0.5);

        this.addText(container, WIDTH / 2, 174, "UNE ENQUÊTE. DES INDICES. UNE SEULE VÉRITÉ.", {
            fontSize: "16px",
            color: "#9daac4",
            letterSpacing: 2
        }).setOrigin(0.5);

        this.drawDecorativeSeal(container, WIDTH / 2, 255);

        this.addText(container, WIDTH / 2, 340, "CHOISISSEZ VOTRE NIVEAU", {
            fontSize: "20px",
            fontStyle: "bold",
            color: "#e8edf8",
            letterSpacing: 1.5
        }).setOrigin(0.5);

        const profiles = Object.values(DIFFICULTY_PROFILES);
        const cardWidth = 278;
        const cardHeight = 250;
        const gap = 20;
        const totalWidth = profiles.length * cardWidth + (profiles.length - 1) * gap;
        const startX = (WIDTH - totalWidth) / 2;
        const cardY = 390;

        profiles.forEach((profile, index) => {
            const x = startX + index * (cardWidth + gap);
            const selected = this.selectedDifficulty === profile.id;
            this.drawDifficultyCard(container, profile, x, cardY, cardWidth, cardHeight, selected);
        });

        const selectedProfile = DIFFICULTY_PROFILES[this.selectedDifficulty];
        this.addButton(
            container,
            "COMMENCER L'ENQUÊTE",
            WIDTH / 2 - 150,
            700,
            300,
            62,
            () => this.scene.start("GameScene", { difficulty: this.selectedDifficulty }),
            selectedProfile.accent,
            true
        );

        this.addText(container, WIDTH / 2, 795,
            "1 PERSONNE PAR LIGNE ET PAR COLONNE  •  TROUVEZ LE SUSPECT DANS LA PIÈCE DE LA VICTIME",
            { fontSize: "12px", color: "#7f8ba3", letterSpacing: 0.8 }
        ).setOrigin(0.5);

        this.addText(container, WIDTH / 2, 910, "MURDOKU  •  PROTOTYPE", {
            fontSize: "11px",
            color: "#526078",
            letterSpacing: 2
        }).setOrigin(0.5);

        const scale = Math.min(this.scale.width / WIDTH, this.scale.height / HEIGHT, 1);
        container.setScale(scale);
        container.setPosition(
            (this.scale.width - WIDTH * scale) / 2,
            (this.scale.height - HEIGHT * scale) / 2
        );
    }

    private drawMobileMenu(): void {
        this.menuContainer?.destroy(true);
        const container = this.add.container(0, 0);
        this.menuContainer = container;
        const width = this.scale.width;
        const height = this.scale.height;

        const bg = this.add.graphics();
        bg.fillStyle(0x0b1020, 1);
        bg.fillRect(0, 0, width, height);
        bg.fillStyle(0x17223a, 0.48);
        bg.fillCircle(width * 0.08, height * 0.12, Math.min(width * 0.7, 230));
        bg.fillStyle(0x1b1833, 0.36);
        bg.fillCircle(width * 0.92, height * 0.82, Math.min(width * 0.8, 270));
        bg.lineStyle(1, 0x293550, 0.24);
        for (let x = 0; x <= width; x += 32) bg.lineBetween(x, 0, x, height);
        for (let y = 0; y <= height; y += 32) bg.lineBetween(0, y, width, y);
        container.add(bg);

        this.addText(container, width / 2, 48, "MURDOKU", {
            fontSize: "34px", fontStyle: "bold", color: "#f7f8fc", letterSpacing: 3
        }).setOrigin(0.5);
        this.addText(container, width / 2, 82, "UNE ENQUÊTE. DES INDICES. UNE SEULE VÉRITÉ.", {
            fontSize: "9px", color: "#9daac4", letterSpacing: 0.5, align: "center"
        }).setOrigin(0.5);
        this.addText(container, width / 2, 133, "CHOISIS TON NIVEAU", {
            fontSize: "15px", fontStyle: "bold", color: "#e8edf8", letterSpacing: 1
        }).setOrigin(0.5);

        const profiles = Object.values(DIFFICULTY_PROFILES);
        const margin = 14;
        const cardWidth = width - margin * 2;
        const gap = 8;
        const cardHeight = Math.max(72, Math.min(88, (height - 330 - gap * 3) / 4));
        const startY = 158;

        profiles.forEach((profile, index) => {
            const y = startY + index * (cardHeight + gap);
            const selected = this.selectedDifficulty === profile.id;
            const background = this.add.rectangle(
                width / 2, y + cardHeight / 2, cardWidth, cardHeight,
                selected ? 0x202d46 : 0x151e31, 1
            ).setStrokeStyle(selected ? 2.5 : 1, selected ? profile.accent : 0x2e3a53, 1);
            background.setInteractive({ useHandCursor: true });
            background.on("pointerdown", () => {
                this.selectedDifficulty = profile.id;
                this.drawMenu();
            });
            container.add(background);

            const emblem = this.add.circle(margin + 35, y + cardHeight / 2, 22, profile.accent, 0.16)
                .setStrokeStyle(1.5, profile.accent, 0.85);
            container.add(emblem);
            this.addText(container, margin + 35, y + cardHeight / 2, String(profile.size), {
                fontSize: "19px", fontStyle: "bold", color: profile.accentHex
            }).setOrigin(0.5);
            this.addText(container, margin + 70, y + 14, profile.label.toUpperCase(), {
                fontSize: "14px", fontStyle: "bold", color: "#f3f5fa", letterSpacing: 0.6
            });
            this.addText(container, margin + 70, y + 35,
                `${profile.size} × ${profile.size}  •  ${profile.suspects} suspects  •  ${profile.rooms} pièces`,
                { fontSize: "10px", color: profile.accentHex }
            );
            this.addText(container, margin + 70, y + 54, profile.subtitle, {
                fontSize: "10px", color: "#9ba8bf"
            });
            if (selected) {
                const check = this.addText(container, width - margin - 18, y + cardHeight / 2, "✓", {
                    fontSize: "18px", color: profile.accentHex, fontStyle: "bold"
                }).setOrigin(0.5);
                container.add(check);
            }
        });

        const buttonY = startY + profiles.length * (cardHeight + gap) + 13;
        const selectedProfile = DIFFICULTY_PROFILES[this.selectedDifficulty];
        this.addButton(container, "COMMENCER L'ENQUÊTE", 18, buttonY, width - 36, 50,
            () => this.scene.start("GameScene", { difficulty: this.selectedDifficulty }),
            selectedProfile.accent, true
        );
        this.addText(container, width / 2, buttonY + 70,
            "1 personne par ligne et par colonne.\nTrouve le suspect dans la pièce de la victime.",
            { fontSize: "10px", color: "#7f8ba3", align: "center", lineSpacing: 4 }
        ).setOrigin(0.5);
        this.addText(container, width / 2, height - 18, "MURDOKU  •  PROTOTYPE", {
            fontSize: "9px", color: "#526078", letterSpacing: 1.5
        }).setOrigin(0.5);
    }

    private drawBackground(container: Phaser.GameObjects.Container): void {
        const graphics = this.add.graphics();
        graphics.fillStyle(0x0b1020, 1);
        graphics.fillRect(0, 0, WIDTH, HEIGHT);
        graphics.fillStyle(0x17223a, 0.45);
        graphics.fillCircle(180, 140, 260);
        graphics.fillStyle(0x1b1833, 0.45);
        graphics.fillCircle(1260, 720, 350);
        graphics.lineStyle(1, 0x293550, 0.35);
        for (let x = 0; x <= WIDTH; x += 48) graphics.lineBetween(x, 0, x, HEIGHT);
        for (let y = 0; y <= HEIGHT; y += 48) graphics.lineBetween(0, y, WIDTH, y);
        container.add(graphics);

        const topLine = this.add.rectangle(WIDTH / 2, 20, 1180, 1, 0x34415c, 0.55);
        const bottomLine = this.add.rectangle(WIDTH / 2, HEIGHT - 24, 1180, 1, 0x34415c, 0.35);
        container.add([topLine, bottomLine]);
    }

    private drawDecorativeSeal(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number
    ): void {
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x8299c5, 0.75);
        graphics.strokeCircle(x, y, 43);
        graphics.lineStyle(1, 0x8299c5, 0.35);
        graphics.strokeCircle(x, y, 34);
        graphics.lineBetween(x - 24, y, x + 24, y);
        graphics.lineBetween(x, y - 24, x, y + 24);
        graphics.fillStyle(0x7da7f7, 0.9);
        graphics.fillCircle(x, y, 5);
        container.add(graphics);
        this.addText(container, x, y + 61, "DOSSIER N° 001", {
            fontSize: "10px",
            color: "#7888a5",
            letterSpacing: 2
        }).setOrigin(0.5);
    }

    private drawDifficultyCard(
        container: Phaser.GameObjects.Container,
        profile: DifficultyProfile,
        x: number,
        y: number,
        width: number,
        height: number,
        selected: boolean
    ): void {
        const accent = profile.accent;
        const background = this.add.rectangle(
            x + width / 2,
            y + height / 2,
            width,
            height,
            selected ? 0x202d46 : 0x151e31,
            1
        ).setStrokeStyle(selected ? 3 : 1, selected ? accent : 0x2e3a53, 1);
        background.setInteractive({ useHandCursor: true });
        background.on("pointerover", () => {
            if (this.selectedDifficulty !== profile.id) background.setStrokeStyle(2, accent, 0.75);
        });
        background.on("pointerout", () => {
            if (this.selectedDifficulty !== profile.id) background.setStrokeStyle(1, 0x2e3a53, 1);
        });
        background.on("pointerdown", () => {
            this.selectedDifficulty = profile.id;
            this.drawMenu();
        });
        container.add(background);

        const emblem = this.add.circle(x + width / 2, y + 52, 25, accent, 0.16)
            .setStrokeStyle(1.5, accent, 0.8);
        container.add(emblem);
        this.addText(container, x + width / 2, y + 52, String(profile.size), {
            fontSize: "22px",
            fontStyle: "bold",
            color: profile.accentHex
        }).setOrigin(0.5);

        this.addText(container, x + width / 2, y + 100, profile.label.toUpperCase(), {
            fontSize: "20px",
            fontStyle: "bold",
            color: "#f3f5fa",
            letterSpacing: 1
        }).setOrigin(0.5);

        this.addText(container, x + width / 2, y + 128, profile.subtitle, {
            fontSize: "12px",
            color: profile.accentHex
        }).setOrigin(0.5);

        this.addText(container, x + width / 2, y + 166,
            `${profile.size} × ${profile.size}  •  ${profile.rooms} pièces`,
            { fontSize: "13px", color: "#dce3f1", fontStyle: "bold" }
        ).setOrigin(0.5);

        this.addText(container, x + width / 2, y + 190,
            `${profile.suspects} suspects + 1 victime`,
            { fontSize: "12px", color: "#9ba8bf" }
        ).setOrigin(0.5);

        this.addText(container, x + width / 2, y + 218, profile.description, {
            fontSize: "11px",
            color: "#8794ad",
            align: "center",
            wordWrap: { width: width - 48 },
            lineSpacing: 3
        }).setOrigin(0.5, 0);

        if (selected) {
            const selectedPill = this.add.rectangle(x + width / 2, y + height - 12, 84, 4, accent, 1);
            container.add(selectedPill);
        }
    }

    private addText(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        text: string,
        style: Phaser.Types.GameObjects.Text.TextStyle = {}
    ): Phaser.GameObjects.Text {
        const object = this.add.text(x, y, text, {
            fontFamily: "Arial, sans-serif",
            fontSize: "16px",
            color: "#ffffff",
            ...style
        });
        container.add(object);
        return object;
    }

    private addButton(
        container: Phaser.GameObjects.Container,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        callback: () => void,
        color: number,
        primary = false
    ): void {
        const bg = this.add.rectangle(
            x + width / 2,
            y + height / 2,
            width,
            height,
            primary ? color : 0x202b40,
            primary ? 1 : 0.95
        ).setStrokeStyle(1, color, primary ? 0.9 : 0.55);
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setAlpha(0.82));
        bg.on("pointerout", () => bg.setAlpha(1));
        bg.on("pointerdown", callback);
        container.add(bg);

        this.addText(container, x + width / 2, y + height / 2, label, {
            fontSize: "14px",
            fontStyle: "bold",
            color: primary ? "#101728" : "#e9eef8",
            letterSpacing: 0.6
        }).setOrigin(0.5);
    }
}
