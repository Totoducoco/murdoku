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
        description: "Petite grille et déductions accessibles."
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
        description: "Plus de pièces et de relations à croiser."
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
        description: "Une grille plus vaste et davantage de suspects."
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
        description: "Le plus grand plateau et le maximum de relations."
    }
};

const COLORS = {
    background: 0x0b1020,
    panel: 0x151f32,
    panelSelected: 0x202d46,
    border: 0x2e3a53,
    text: "#f3f6fc",
    muted: "#9ba8bf"
};

type CardLayout = "vertical" | "horizontal";

/**
 * Menu adaptatif : tous les éléments sont dessinés directement dans
 * les dimensions réelles du canvas. Aucun Container.setScale() n'est
 * utilisé, afin d'éviter de flouter les textes sur tablette.
 */
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

    private drawMenu(): void {
        this.menuContainer?.destroy(true);

        const width = Math.max(320, Math.floor(this.scale.width));
        const height = Math.max(320, Math.floor(this.scale.height));
        const container = this.add.container(0, 0);
        this.menuContainer = container;

        this.drawBackground(container, width, height);

        if (width >= 1160 && height >= 740) {
            this.drawDesktopLayout(container, width, height);
        } else if (height < 560 && width >= 640) {
            this.drawShortLandscapeLayout(container, width, height);
        } else if (width < 640) {
            this.drawPhoneLayout(container, width, height);
        } else {
            this.drawTabletLayout(container, width, height);
        }
    }

    private drawBackground(
        container: Phaser.GameObjects.Container,
        width: number,
        height: number
    ): void {
        const graphics = this.add.graphics();
        graphics.fillStyle(COLORS.background, 1);
        graphics.fillRect(0, 0, width, height);
        graphics.fillStyle(0x17233d, 0.48);
        graphics.fillCircle(Math.round(width * 0.08), Math.round(height * 0.14), Math.min(width * 0.24, 270));
        graphics.fillStyle(0x211a3a, 0.30);
        graphics.fillCircle(Math.round(width * 0.94), Math.round(height * 0.84), Math.min(width * 0.28, 320));
        graphics.lineStyle(1, 0x293550, 0.22);
        const step = width < 640 ? 36 : 48;
        for (let x = 0; x <= width; x += step) graphics.lineBetween(x, 0, x, height);
        for (let y = 0; y <= height; y += step) graphics.lineBetween(0, y, width, y);
        container.add(graphics);

        const topLine = this.add.rectangle(Math.round(width / 2), 12, Math.max(0, width - 48), 1, 0x34415c, 0.55);
        container.add(topLine);
    }

    private drawBrand(
        container: Phaser.GameObjects.Container,
        width: number,
        y: number,
        compact = false
    ): void {
        const centerX = Math.round(width / 2);
        const titleSize = compact ? 34 : Math.max(42, Math.min(66, Math.round(width * 0.046)));
        this.addText(container, centerX, y, "MURDOKU", {
            fontSize: `${titleSize}px`,
            fontStyle: "bold",
            color: COLORS.text,
            letterSpacing: compact ? 2 : 4
        }).setOrigin(0.5);
        this.addText(container, centerX, y + (compact ? 30 : 47), "UNE ENQUÊTE. DES INDICES. UNE SEULE VÉRITÉ.", {
            fontSize: compact ? "11px" : "14px",
            color: "#9daac4",
            letterSpacing: compact ? 0.4 : 1.4
        }).setOrigin(0.5);
    }

    private drawDesktopLayout(
        container: Phaser.GameObjects.Container,
        width: number,
        height: number
    ): void {
        this.drawBrand(container, width, Math.round(height * 0.105));

        this.drawSeal(container, Math.round(width / 2), Math.round(height * 0.265));
        this.addText(container, Math.round(width / 2), Math.round(height * 0.345), "CHOISISSEZ VOTRE NIVEAU", {
            fontSize: "20px",
            fontStyle: "bold",
            color: "#e8edf8",
            letterSpacing: 1.2
        }).setOrigin(0.5);

        const profiles = Object.values(DIFFICULTY_PROFILES);
        const margin = 44;
        const gap = 18;
        const cardWidth = Math.min(278, Math.floor((width - margin * 2 - gap * 3) / 4));
        const cardHeight = Math.min(246, Math.max(208, Math.round(height * 0.255)));
        const totalWidth = cardWidth * 4 + gap * 3;
        const startX = Math.round((width - totalWidth) / 2);
        const cardY = Math.round(height * 0.405);

        profiles.forEach((profile, index) => {
            this.drawDifficultyCard(
                container,
                profile,
                startX + index * (cardWidth + gap),
                cardY,
                cardWidth,
                cardHeight,
                this.selectedDifficulty === profile.id,
                "vertical"
            );
        });

        const buttonY = cardY + cardHeight + 28;
        this.addButton(container, "COMMENCER L'ENQUÊTE", Math.round(width / 2) - 150, buttonY,
            300, 56, () => this.startGame(), DIFFICULTY_PROFILES[this.selectedDifficulty].accent, true);
        this.addText(container, Math.round(width / 2), buttonY + 78,
            "1 personne par ligne et par colonne  •  Trouvez le suspect dans la pièce de la victime",
            { fontSize: "12px", color: "#8491aa", letterSpacing: 0.25 }
        ).setOrigin(0.5);
        this.addText(container, Math.round(width / 2), height - 24, "MURDOKU  •  PROTOTYPE", {
            fontSize: "11px", color: "#596782", letterSpacing: 1.8
        }).setOrigin(0.5);
    }

    private drawTabletLayout(
        container: Phaser.GameObjects.Container,
        width: number,
        height: number
    ): void {
        this.drawBrand(container, width, 42, true);
        this.addText(container, Math.round(width / 2), 112, "CHOISISSEZ VOTRE NIVEAU", {
            fontSize: "17px", fontStyle: "bold", color: "#e8edf8", letterSpacing: 0.8
        }).setOrigin(0.5);

        const profiles = Object.values(DIFFICULTY_PROFILES);
        const margin = 24;
        const gapX = 14;
        const gapY = 12;
        const cardWidth = Math.floor((width - margin * 2 - gapX) / 2);
        const cardHeight = Math.min(174, Math.max(128, Math.floor((height - 250 - gapY) / 2)));
        const totalHeight = cardHeight * 2 + gapY;
        const startY = height >= 700 ? 150 : 108;

        profiles.forEach((profile, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = margin + col * (cardWidth + gapX);
            const y = startY + row * (cardHeight + gapY);
            this.drawDifficultyCard(
                container, profile, x, y, cardWidth, cardHeight,
                this.selectedDifficulty === profile.id, "vertical"
            );
        });

        const buttonY = Math.min(height - 112, startY + totalHeight + 20);
        this.addButton(container, "COMMENCER L'ENQUÊTE", Math.round(width / 2) - 138, buttonY,
            276, 48, () => this.startGame(), DIFFICULTY_PROFILES[this.selectedDifficulty].accent, true);
        this.addText(container, Math.round(width / 2), Math.min(height - 28, buttonY + 68),
            "1 personne par ligne et par colonne. Trouvez le suspect dans la pièce de la victime.",
            { fontSize: "11px", color: "#8491aa", align: "center", wordWrap: { width: width - 44 } }
        ).setOrigin(0.5);
    }

    private drawPhoneLayout(
        container: Phaser.GameObjects.Container,
        width: number,
        height: number
    ): void {
        this.drawBrand(container, width, 32, true);
        this.addText(container, Math.round(width / 2), 104, "CHOISIS TON NIVEAU", {
            fontSize: "15px", fontStyle: "bold", color: "#e8edf8", letterSpacing: 0.7
        }).setOrigin(0.5);

        const margin = 14;
        const gap = 7;
        const cardHeight = Math.max(62, Math.min(86, Math.floor((height - 260 - gap * 3) / 4)));
        const cardWidth = width - margin * 2;
        const startY = 126;

        Object.values(DIFFICULTY_PROFILES).forEach((profile, index) => {
            this.drawDifficultyCard(
                container,
                profile,
                margin,
                startY + index * (cardHeight + gap),
                cardWidth,
                cardHeight,
                this.selectedDifficulty === profile.id,
                "horizontal"
            );
        });

        const buttonY = Math.min(height - 106, startY + 4 * cardHeight + 3 * gap + 13);
        this.addButton(container, "COMMENCER L'ENQUÊTE", 18, buttonY, width - 36, 46,
            () => this.startGame(), DIFFICULTY_PROFILES[this.selectedDifficulty].accent, true);
        this.addText(container, Math.round(width / 2), Math.min(height - 34, buttonY + 62),
            "Une personne par ligne et par colonne.",
            { fontSize: "10px", color: "#8491aa" }
        ).setOrigin(0.5);
        this.addText(container, Math.round(width / 2), height - 14, "MURDOKU", {
            fontSize: "9px", color: "#596782", letterSpacing: 1.5
        }).setOrigin(0.5);
    }

    /** Deux colonnes compactes pour les téléphones en paysage et petites fenêtres. */
    private drawShortLandscapeLayout(
        container: Phaser.GameObjects.Container,
        width: number,
        height: number
    ): void {
        this.addText(container, Math.round(width / 2), 26, "MURDOKU", {
            fontSize: "27px", fontStyle: "bold", color: COLORS.text, letterSpacing: 2
        }).setOrigin(0.5);
        this.addText(container, Math.round(width / 2), 56, "CHOISISSEZ VOTRE NIVEAU", {
            fontSize: "13px", fontStyle: "bold", color: "#e8edf8", letterSpacing: 0.5
        }).setOrigin(0.5);

        const margin = 18;
        const gapX = 10;
        const gapY = 7;
        const cardWidth = Math.floor((width - margin * 2 - gapX) / 2);
        const cardHeight = Math.max(74, Math.min(104, Math.floor((height - 132 - gapY) / 2)));
        const startY = 72;

        Object.values(DIFFICULTY_PROFILES).forEach((profile, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            this.drawDifficultyCard(
                container, profile,
                margin + col * (cardWidth + gapX),
                startY + row * (cardHeight + gapY),
                cardWidth, cardHeight,
                this.selectedDifficulty === profile.id,
                "horizontal"
            );
        });

        const buttonY = Math.min(height - 46, startY + 2 * cardHeight + gapY + 7);
        this.addButton(container, "COMMENCER", Math.round(width / 2) - 112, buttonY,
            224, 38, () => this.startGame(), DIFFICULTY_PROFILES[this.selectedDifficulty].accent, true);
    }

    private drawSeal(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number
    ): void {
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x8299c5, 0.75);
        graphics.strokeCircle(x, y, 36);
        graphics.lineStyle(1, 0x8299c5, 0.35);
        graphics.strokeCircle(x, y, 28);
        graphics.lineBetween(x - 18, y, x + 18, y);
        graphics.lineBetween(x, y - 18, x, y + 18);
        graphics.fillStyle(0x7da7f7, 0.95);
        graphics.fillCircle(x, y, 4);
        container.add(graphics);
    }

    private drawDifficultyCard(
        container: Phaser.GameObjects.Container,
        profile: DifficultyProfile,
        x: number,
        y: number,
        width: number,
        height: number,
        selected: boolean,
        layout: CardLayout
    ): void {
        const accent = profile.accent;
        const borderColor = selected ? accent : COLORS.border;
        const background = this.add.rectangle(
            Math.round(x + width / 2),
            Math.round(y + height / 2),
            width,
            height,
            selected ? COLORS.panelSelected : COLORS.panel,
            1
        ).setStrokeStyle(selected ? 2 : 1, borderColor, 1);
        background.setInteractive({ useHandCursor: true });
        background.on("pointerover", () => {
            if (!selected) background.setStrokeStyle(2, accent, 0.8);
        });
        background.on("pointerout", () => {
            if (this.selectedDifficulty !== profile.id) background.setStrokeStyle(1, COLORS.border, 1);
        });
        background.on("pointerdown", () => {
            this.selectedDifficulty = profile.id;
            this.drawMenu();
        });
        container.add(background);

        if (layout === "horizontal") {
            this.drawHorizontalCardContent(container, profile, x, y, width, height, selected);
        } else {
            this.drawVerticalCardContent(container, profile, x, y, width, height, selected);
        }
    }

    private drawVerticalCardContent(
        container: Phaser.GameObjects.Container,
        profile: DifficultyProfile,
        x: number,
        y: number,
        width: number,
        height: number,
        selected: boolean
    ): void {
        const centerX = Math.round(x + width / 2);
        const compact = height < 205;
        const badgeY = y + (compact ? 25 : 39);
        const radius = compact ? 18 : 23;
        const emblem = this.add.circle(centerX, badgeY, radius, profile.accent, 0.16)
            .setStrokeStyle(1.5, profile.accent, 0.85);
        container.add(emblem);
        this.addText(container, centerX, badgeY, String(profile.size), {
            fontSize: compact ? "17px" : "21px",
            fontStyle: "bold",
            color: profile.accentHex
        }).setOrigin(0.5);

        const labelY = y + (compact ? 54 : 79);
        this.addText(container, centerX, labelY, profile.label.toUpperCase(), {
            fontSize: compact ? "15px" : "18px",
            fontStyle: "bold",
            color: COLORS.text,
            letterSpacing: 0.6
        }).setOrigin(0.5);

        if (compact) {
            this.addText(container, centerX, y + 77, profile.subtitle, {
                fontSize: "11px", color: profile.accentHex
            }).setOrigin(0.5);
            this.addText(container, centerX, y + 101,
                `${profile.size} × ${profile.size}  •  ${profile.suspects} suspects  •  ${profile.rooms} pièces`,
                { fontSize: "12px", color: "#dce3f1", fontStyle: "bold" }
            ).setOrigin(0.5);
            if (height >= 165) {
                this.addText(container, centerX, y + 128, profile.description, {
                    fontSize: "11px", color: COLORS.muted,
                    align: "center", wordWrap: { width: width - 30 }
                }).setOrigin(0.5, 0);
            }
        } else {
            this.addText(container, centerX, y + 105, profile.subtitle, {
                fontSize: "12px", color: profile.accentHex
            }).setOrigin(0.5);
            this.addText(container, centerX, y + 139,
                `${profile.size} × ${profile.size}  •  ${profile.rooms} pièces`,
                { fontSize: "13px", color: "#dce3f1", fontStyle: "bold" }
            ).setOrigin(0.5);
            this.addText(container, centerX, y + 162,
                `${profile.suspects} suspects + 1 victime`,
                { fontSize: "12px", color: COLORS.muted }
            ).setOrigin(0.5);
            this.addText(container, centerX, y + 188, profile.description, {
                fontSize: "11px",
                color: "#8794ad",
                align: "center",
                wordWrap: { width: width - 34 },
                lineSpacing: 2
            }).setOrigin(0.5, 0);
        }

        if (selected) {
            const pillY = Math.round(y + height - 7);
            const pill = this.add.rectangle(centerX, pillY, 72, 3, profile.accent, 1);
            container.add(pill);
        }
    }

    private drawHorizontalCardContent(
        container: Phaser.GameObjects.Container,
        profile: DifficultyProfile,
        x: number,
        y: number,
        width: number,
        height: number,
        selected: boolean
    ): void {
        const centerY = Math.round(y + height / 2);
        const badgeX = Math.round(x + 29);
        const radius = Math.min(21, Math.max(16, Math.round(height * 0.25)));
        const emblem = this.add.circle(badgeX, centerY, radius, profile.accent, 0.16)
            .setStrokeStyle(1.4, profile.accent, 0.85);
        container.add(emblem);
        this.addText(container, badgeX, centerY, String(profile.size), {
            fontSize: "17px", fontStyle: "bold", color: profile.accentHex
        }).setOrigin(0.5);

        const textX = x + 58;
        const textWidth = width - 80;
        this.addText(container, textX, y + 10, profile.label.toUpperCase(), {
            fontSize: "14px", fontStyle: "bold", color: COLORS.text, letterSpacing: 0.4
        });
        this.addText(container, textX, y + 31,
            `${profile.size} × ${profile.size}  •  ${profile.suspects} suspects  •  ${profile.rooms} pièces`,
            { fontSize: "11px", color: profile.accentHex }
        );
        if (height >= 92) {
            this.addText(container, textX, y + 51, profile.description, {
                fontSize: "11px", color: COLORS.muted,
                wordWrap: { width: textWidth - 4 }, lineSpacing: 1
            });
        }
        if (selected) {
            const check = this.addText(container, x + width - 18, centerY, "✓", {
                fontSize: "17px", color: profile.accentHex, fontStyle: "bold"
            }).setOrigin(0.5);
            container.add(check);
        }
    }

    private startGame(): void {
        this.scene.start("GameScene", { difficulty: this.selectedDifficulty });
    }

    private addText(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        text: string,
        style: Phaser.Types.GameObjects.Text.TextStyle = {}
    ): Phaser.GameObjects.Text {
        const object = this.add.text(Math.round(x), Math.round(y), text, {
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "15px",
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
            Math.round(x + width / 2),
            Math.round(y + height / 2),
            Math.round(width),
            Math.round(height),
            primary ? color : 0x202b40,
            1
        ).setStrokeStyle(1, color, primary ? 0.95 : 0.65);
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setAlpha(0.84));
        bg.on("pointerout", () => bg.setAlpha(1));
        bg.on("pointerdown", callback);
        container.add(bg);

        this.addText(container, x + width / 2, y + height / 2, label, {
            fontSize: height <= 42 ? "12px" : "14px",
            fontStyle: "bold",
            color: primary ? "#101728" : "#e9eef8",
            letterSpacing: 0.35,
            align: "center"
        }).setOrigin(0.5);
    }
}
