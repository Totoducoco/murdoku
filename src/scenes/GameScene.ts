import Phaser from "phaser";
import { generatePuzzle } from "../game/generator/puzzleGenerator";
import type { Clue, Person, Position } from "../game/model/types";
import { DIFFICULTY_PROFILES, type MurdokuDifficulty } from "./MenuScene";

type GeneratedCase = ReturnType<typeof generatePuzzle>;
type GameSceneData = { difficulty?: MurdokuDifficulty };

const WIDTH = 1440;
const HEIGHT = 960;
const COLORS = {
    background: 0x0b1020,
    panel: 0x141d30,
    panelLight: 0x1b2740,
    border: 0x2d3b56,
    text: "#edf2fa",
    muted: "#9aa8c0",
    accent: 0x83a9f7,
    green: 0x79c7a5,
    red: 0xe18b8b,
    gold: 0xe7c17b
};

export default class GameScene extends Phaser.Scene {
    private difficulty: MurdokuDifficulty = "normal";
    private seed = 12045;
    private currentCase: GeneratedCase | null = null;
    private playerPositions: Record<string, Position> = {};
    private selectedPersonId: string | null = null;
    private selectedAccusedId: string | null = null;
    private cluePage = 0;
    private statusMessage = "Choisis un personnage, puis une case du plateau.";
    private statusColor = "#aab7ce";
    private finished = false;
    private ui?: Phaser.GameObjects.Container;
    private startedAt = 0;
    private readonly cluePageSize = 6;
    private mobileTab: "board" | "clues" | "accuse" = "board";

    constructor() {
        super("GameScene");
    }

    init(data: GameSceneData): void {
        this.difficulty = data?.difficulty ?? "normal";
    }

    create(): void {
        this.cameras.main.setBackgroundColor(COLORS.background);
        this.scale.on("resize", this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off("resize", this.handleResize, this);
        });
        this.startNewCase();
    }

    private handleResize(): void {
        if (this.currentCase) this.drawInterface();
    }

    private isCompactLayout(): boolean {
        return this.scale.width < 900 || this.scale.height < 650;
    }

    private startNewCase(): void {
        this.seed += 7919;
        const profile = DIFFICULTY_PROFILES[this.difficulty];
        this.finished = false;
        this.statusMessage = "Choisis un personnage, puis une case du plateau.";
        this.statusColor = "#aab7ce";

        try {
            this.currentCase = generatePuzzle({
                size: profile.size,
                roomCount: profile.rooms,
                seed: this.seed,
                maxAttempts: 40
            });

            this.playerPositions = {};
            this.selectedPersonId = this.currentCase.puzzle.people.find(person => person.role === "suspect")?.id ?? null;
            this.selectedAccusedId = null;
            this.cluePage = 0;
            this.mobileTab = "board";
            this.startedAt = Date.now();

            // Les solutions restent en mémoire pour la génération, mais ne sont
            // jamais affichées dans la console ni utilisées pour corriger le joueur.
            console.info("Nouvelle affaire générée", {
                id: this.currentCase.puzzle.id,
                mode: profile.label,
                size: profile.size,
                clues: this.currentCase.puzzle.clues.length,
                estimatedComplexity: this.currentCase.evaluation.score
            });

            this.drawInterface();
        } catch (error) {
            console.error("Impossible de générer une affaire :", error);
            this.currentCase = null;
            this.drawGenerationError(error instanceof Error ? error.message : String(error));
        }
    }

    private drawGenerationError(message: string): void {
        if (this.isCompactLayout()) {
            this.ui?.destroy(true);
            const container = this.add.container(0, 0);
            this.ui = container;
            const width = this.scale.width;
            const height = this.scale.height;
            const bg = this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 1);
            container.add(bg);
            this.addText(container, width / 2, height * 0.34, "DOSSIER INTROUVABLE", 22, "#f2f5fb", true)
                .setOrigin(0.5);
            this.addText(container, width / 2, height * 0.43, "La génération de cette affaire a échoué.", 13, "#e3a0a0", false, 0,
                { align: "center", wordWrap: { width: width - 40 } }).setOrigin(0.5);
            this.addText(container, width / 2, height * 0.50, message.slice(0, 160), 10, COLORS.muted, false, 0,
                { align: "center", wordWrap: { width: width - 40 } }).setOrigin(0.5);
            this.addButton(container, "RÉESSAYER", 16, height * 0.59, width - 32, 46,
                () => this.startNewCase(), COLORS.accent, true);
            this.addButton(container, "RETOUR AU MENU", 16, height * 0.67, width - 32, 44,
                () => this.scene.start("MenuScene"), 0x53627d, false);
            return;
        }
        this.ui?.destroy(true);
        const container = this.add.container(0, 0);
        this.ui = container;
        this.drawBackdrop(container);
        this.addText(container, WIDTH / 2, 320, "DOSSIER INTROUVABLE", 32, "#f2f5fb", true).setOrigin(0.5);
        this.addText(container, WIDTH / 2, 390, "La génération de cette affaire a échoué.", 18, "#e3a0a0").setOrigin(0.5);
        this.addText(container, WIDTH / 2, 430, message.slice(0, 160), 13, COLORS.muted).setOrigin(0.5);
        this.addButton(container, "RÉESSAYER", 510, 520, 180, 52, () => this.startNewCase(), COLORS.accent, true);
        this.addButton(container, "RETOUR AU MENU", 730, 520, 200, 52, () => this.scene.start("MenuScene"), 0x53627d, false);
    }

    private drawInterface(): void {
        if (!this.currentCase) return;
        if (this.isCompactLayout()) {
            this.drawMobileInterface();
            return;
        }
        this.ui?.destroy(true);
        const container = this.add.container(0, 0);
        this.ui = container;
        this.drawBackdrop(container);

        const puzzle = this.currentCase.puzzle;
        const profile = DIFFICULTY_PROFILES[this.difficulty];

        // Bandeau supérieur.
        this.addText(container, 54, 35, "MURDOKU", 27, "#f4f6fb", true, 2);
        this.addText(container, 56, 70, `DOSSIER ${puzzle.id.toUpperCase()}`, 11, "#7788a6", true, 1.5);
        this.drawPill(container, 750, 42, `${profile.label.toUpperCase()}  •  ${profile.size} × ${profile.size}`, profile.accent, 210);
        this.drawPill(container, 975, 42, `${puzzle.clues.length} INDICES`, 0x7c8ba6, 130);
        this.addButton(container, "NOUVELLE AFFAIRE", 1125, 22, 175, 42, () => this.startNewCase(), 0x7da7f7, false);
        this.addButton(container, "MENU", 1310, 22, 82, 42, () => this.scene.start("MenuScene"), 0x52627e, false);

        // Grands panneaux.
        this.drawPanel(container, 42, 112, 600, 805);
        this.drawPanel(container, 664, 112, 734, 805);

        this.addText(container, 70, 140, "LE PLAN DES LIEUX", 17, "#eaf0fa", true, 0.8);
        this.addText(container, 70, 166, "Place chaque personne en respectant les indices.", 12, COLORS.muted);
        this.addText(container, 690, 140, "CARNET D'ENQUÊTE", 17, "#eaf0fa", true, 0.8);
        this.addText(container, 690, 166, "Les indices sont regroupés par suspect.", 12, COLORS.muted);

        this.drawBoard(container);
        this.drawCharacterPicker(container);
        this.drawClues(container);
        this.drawAccusation(container);
        this.drawStatus(container);

        // Le layout desktop conserve son canevas de référence, mais s'adapte
        // aux fenêtres plus petites sans rogner les panneaux.
        const scale = Math.min(this.scale.width / WIDTH, this.scale.height / HEIGHT, 1);
        container.setScale(scale);
        container.setPosition(
            (this.scale.width - WIDTH * scale) / 2,
            (this.scale.height - HEIGHT * scale) / 2
        );
    }

    /** Interface portrait compacte : navigation par onglets pour rester lisible. */
    private drawMobileInterface(): void {
        if (!this.currentCase) return;
        this.ui?.destroy(true);
        const container = this.add.container(0, 0);
        this.ui = container;

        const width = this.scale.width;
        const height = this.scale.height;
        const puzzle = this.currentCase.puzzle;
        const profile = DIFFICULTY_PROFILES[this.difficulty];

        const bg = this.add.graphics();
        bg.fillStyle(COLORS.background, 1);
        bg.fillRect(0, 0, width, height);
        bg.fillStyle(0x17233a, 0.42);
        bg.fillCircle(width * 0.08, 100, Math.min(width * 0.7, 240));
        bg.fillStyle(0x1c1834, 0.28);
        bg.fillCircle(width * 0.92, height * 0.82, Math.min(width * 0.8, 260));
        container.add(bg);

        this.addText(container, 14, 14, "MURDOKU", 20, "#f4f6fb", true, 1.4);
        this.addText(container, 15, 42, `DOSSIER ${puzzle.id.toUpperCase()}`, 9, "#8291ad", true, 0.8);
        this.addText(container, 15, 61,
            `${profile.label.toUpperCase()}  •  ${profile.size} × ${profile.size}  •  ${puzzle.clues.length} indices`,
            10, profile.accentHex, true
        );
        this.addButton(container, "NOUVELLE", width - 154, 14, 86, 34,
            () => this.startNewCase(), 0x7da7f7, false);
        this.addButton(container, "MENU", width - 62, 14, 48, 34,
            () => this.scene.start("MenuScene"), 0x52627e, false);

        this.drawMobileTabs(container, width);

        if (this.mobileTab === "board") {
            this.drawMobileBoardTab(container, width, height);
        } else if (this.mobileTab === "clues") {
            this.drawMobileCluesTab(container, width, height);
        } else {
            this.drawMobileAccuseTab(container, width, height);
        }
    }

    private drawMobileTabs(container: Phaser.GameObjects.Container, width: number): void {
        const tabs: Array<{ id: "board" | "clues" | "accuse"; label: string }> = [
            { id: "board", label: "PLATEAU" },
            { id: "clues", label: "INDICES" },
            { id: "accuse", label: "ACCUSATION" }
        ];
        const margin = 12;
        const gap = 6;
        const buttonWidth = (width - margin * 2 - gap * 2) / 3;
        tabs.forEach((tab, index) => {
            this.addButton(container, tab.label, margin + index * (buttonWidth + gap), 88,
                buttonWidth, 40,
                () => { this.mobileTab = tab.id; this.drawInterface(); },
                this.mobileTab === tab.id ? COLORS.accent : 0x52627e,
                this.mobileTab === tab.id
            );
        });
    }

    private drawMobileBoardTab(
        container: Phaser.GameObjects.Container,
        width: number,
        height: number
    ): void {
        if (!this.currentCase) return;
        const board = this.currentCase.puzzle.board;
        this.addText(container, 16, 145, "LE PLAN DES LIEUX", 13, "#eaf0fa", true, 0.6);
        this.addText(container, 16, 164, "Sélectionne un personnage, puis touche une case.", 10, COLORS.muted);

        const gridMax = Math.min(width - 32, height < 700 ? 270 : 430);
        const cellSize = Math.min(64, gridMax / board.size);
        const boardWidth = cellSize * board.size;
        const startX = (width - boardWidth) / 2;
        const startY = 190;
        const graphics = this.add.graphics();
        container.add(graphics);

        for (let row = 0; row < board.size; row++) {
            for (let col = 0; col < board.size; col++) {
                const cell = board.cells[row][col];
                const room = board.rooms.find(item => item.id === cell.roomId);
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;
                const color = room
                    ? Phaser.Display.Color.HexStringToColor(room.color).color
                    : 0x596174;

                graphics.fillStyle(color, 0.96);
                graphics.fillRoundedRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3, 6);
                graphics.lineStyle(1, 0xffffff, 0.18);
                graphics.strokeRoundedRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3, 6);

                const objects = board.objects.filter(object =>
                    object.position.row === row && object.position.col === col
                );
                const object = objects[0];
                if (objects.some(item => !item.occupiable)) {
                    graphics.fillStyle(0x0b1020, 0.25);
                    graphics.fillRoundedRect(x + 3, y + 3, cellSize - 6, cellSize - 6, 5);
                }

                const hitArea = this.add.rectangle(
                    x + cellSize / 2, y + cellSize / 2,
                    cellSize - 2, cellSize - 2, 0xffffff, 0.001
                ).setInteractive({ useHandCursor: true });
                hitArea.on("pointerdown", () => this.handleCellClick(row, col));
                container.add(hitArea);

                if (object) {
                    const objectLabel = objects.length > 1
                        ? `${this.getObjectShortName(object.name)} ×${objects.length}`
                        : this.getObjectShortName(object.name);
                    this.addText(container, x + cellSize / 2, y + cellSize - 4,
                        objectLabel, Math.max(7, Math.min(10, cellSize / 6.5)),
                        object.occupiable ? "#243149" : "#f7f8fb", true
                    ).setOrigin(0.5, 1);
                }

                const placed = this.getPersonAt(row, col);
                if (placed) {
                    const isVictim = placed.role === "victim";
                    const cx = x + cellSize / 2;
                    const cy = y + cellSize / 2 - (object ? 4 : 0);
                    const radius = Math.min(21, cellSize * 0.28);
                    const marker = this.add.circle(cx, cy, radius, isVictim ? 0xa84e61 : 0x263b5e)
                        .setStrokeStyle(2, 0xffffff, 0.95);
                    container.add(marker);
                    const personIndex = this.currentCase.puzzle.people
                        .filter(person => person.role === "suspect")
                        .findIndex(person => person.id === placed.id);
                    this.addText(container, cx, cy, isVictim ? "V" : `S${personIndex + 1}`,
                        Math.max(11, Math.min(15, cellSize / 3.5)), "#ffffff", true
                    ).setOrigin(0.5);
                }
            }
        }

        // Étiquettes des pièces : une case lisible par pièce.
        for (const room of board.rooms) {
            const roomCells: Position[] = [];
            for (let row = 0; row < board.size; row++) {
                for (let col = 0; col < board.size; col++) {
                    if (board.cells[row][col].roomId === room.id) roomCells.push({ row, col });
                }
            }
            const available = roomCells.filter(position =>
                !board.objects.some(object => object.position.row === position.row && object.position.col === position.col) &&
                !this.playerPositionsHasCell(position)
            );
            const candidates = available.length ? available : roomCells;
            if (!candidates.length) continue;
            const target = candidates[Math.floor(candidates.length / 2)];
            const x = startX + (target.col + 0.5) * cellSize;
            const y = startY + 12 + target.row * cellSize;
            const roomColor = Phaser.Display.Color.HexStringToColor(room.color).color;
            const tagWidth = Math.min(cellSize - 5, Math.max(40, room.name.length * 5.1 + 8));
            const tag = this.add.rectangle(x, y, tagWidth, 15, 0x111a2b, 0.9)
                .setStrokeStyle(1, roomColor, 0.9);
            container.add(tag);
            this.addText(container, x, y, room.name, 8, "#f5f7fb", true).setOrigin(0.5);
        }

        // Frontières épaisses entre les pièces.
        graphics.lineStyle(3, 0x172033, 1);
        for (let row = 0; row < board.size; row++) {
            for (let col = 0; col < board.size; col++) {
                const roomId = board.cells[row][col].roomId;
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;
                if (col === board.size - 1 || roomId !== board.cells[row][col + 1]?.roomId) {
                    graphics.lineBetween(x + cellSize, y, x + cellSize, y + cellSize);
                }
                if (row === board.size - 1 || roomId !== board.cells[row + 1]?.[col]?.roomId) {
                    graphics.lineBetween(x, y + cellSize, x + cellSize, y + cellSize);
                }
            }
        }
        graphics.lineStyle(3, 0x2e3d59, 1);
        graphics.strokeRoundedRect(startX, startY, boardWidth, boardWidth, 5);

        const people = this.currentCase.puzzle.people;
        const pickerY = startY + boardWidth + 18;
        this.addText(container, 16, pickerY, "PERSONNAGES À PLACER", 11, "#aab8d0", true, 0.5);
        const columns = 4;
        const gap = 6;
        const margin = 14;
        const buttonWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
        const buttonHeight = 37;
        people.forEach((person, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const suspectIndex = people.filter(item => item.role === "suspect").findIndex(item => item.id === person.id);
            const label = person.role === "victim" ? "VICTIME" : `S${suspectIndex + 1}`;
            const placed = Boolean(this.playerPositions[person.id]);
            this.addButton(container, `${label}${placed ? " ✓" : ""}`,
                margin + col * (buttonWidth + gap), pickerY + 18 + row * (buttonHeight + 7),
                buttonWidth, buttonHeight,
                () => {
                    this.selectedPersonId = person.id;
                    this.statusMessage = `${person.name} sélectionné(e). Touche sa case.`;
                    this.statusColor = "#c2d1e8";
                    this.drawInterface();
                },
                this.selectedPersonId === person.id ? COLORS.accent : 0x52627e,
                this.selectedPersonId === person.id
            );
        });

        const rows = Math.ceil(people.length / columns);
        const controlsY = pickerY + 18 + rows * (buttonHeight + 7) + 7;
        const placedCount = Object.keys(this.playerPositions).length;
        this.addText(container, 16, controlsY, `${placedCount}/${people.length} personnages placés`, 10, COLORS.muted);
        this.addButton(container, "EFFACER", 14, controlsY + 22, (width - 34) / 2, 37,
            () => this.clearSelectedPlacement(), 0x586783, false,
            !this.selectedPersonId || !this.playerPositions[this.selectedPersonId]
        );
        this.addButton(container, "RECOMMENCER", 20 + (width - 34) / 2, controlsY + 22, (width - 34) / 2, 37,
            () => this.resetPlayerPlacements(), 0x586783, false, placedCount === 0
        );
        this.addText(container, 16, controlsY + 72, this.statusMessage, 10, this.statusColor, true, 0, {
            wordWrap: { width: width - 32 }, lineSpacing: 2
        });
    }

    private drawMobileCluesTab(
        container: Phaser.GameObjects.Container,
        width: number,
        height: number
    ): void {
        if (!this.currentCase) return;
        const puzzle = this.currentCase.puzzle;
        const clues = this.getCluesOrderedBySuspect();
        const pageSize = height < 700 ? 3 : 4;
        const pageCount = Math.max(1, Math.ceil(clues.length / pageSize));
        this.cluePage = Phaser.Math.Clamp(this.cluePage, 0, pageCount - 1);
        const start = this.cluePage * pageSize;
        const visible = clues.slice(start, start + pageSize);

        this.addText(container, 16, 148, "CARNET D'ENQUÊTE", 15, "#edf2fa", true, 0.5);
        this.addText(container, 16, 171, "Les indices sont classés par suspect.", 10, COLORS.muted);

        const x = 12;
        const cardWidth = width - 24;
        const cardHeight = height < 700 ? 112 : 108;
        const gap = 9;
        const top = 200;
        visible.forEach((clue, index) => {
            const y = top + index * (cardHeight + gap);
            const person = puzzle.people.find(item => item.id === clue.personId);
            const number = person?.role === "victim"
                ? "V"
                : `S${puzzle.people.filter(item => item.role === "suspect").findIndex(item => item.id === person?.id) + 1}`;
            const card = this.add.rectangle(x + cardWidth / 2, y + cardHeight / 2,
                cardWidth, cardHeight, 0x1b263a, 1).setStrokeStyle(1, 0x34435f, 1);
            container.add(card);
            const badge = this.add.rectangle(x + 28, y + 25, 34, 26, 0x314a70, 1);
            container.add(badge);
            this.addText(container, x + 28, y + 25, number, 12, "#f2f5fa", true).setOrigin(0.5);
            this.addText(container, x + 55, y + 14,
                `${person?.name ?? "Personnage"}  •  Indice ${start + index + 1}`,
                11, "#a9c1e8", true
            );
            this.addText(container, x + 16, y + 53, clue.description, 13, "#edf2fa", false, 0, {
                wordWrap: { width: cardWidth - 32 }, lineSpacing: 3
            });
        });

        const navY = top + visible.length * (cardHeight + gap) + 10;
        this.addText(container, width / 2, navY, `${clues.length ? start + 1 : 0}–${Math.min(start + visible.length, clues.length)} / ${clues.length}   •   PAGE ${this.cluePage + 1}/${pageCount}`,
            10, "#9aa8c0", true).setOrigin(0.5);
        this.addButton(container, "← PRÉCÉDENTS", 14, navY + 22, (width - 36) / 2, 40,
            () => { this.cluePage = Math.max(0, this.cluePage - 1); this.drawInterface(); },
            0x52627e, false, this.cluePage === 0
        );
        this.addButton(container, "SUIVANTS →", 22 + (width - 36) / 2, navY + 22, (width - 36) / 2, 40,
            () => { this.cluePage = Math.min(pageCount - 1, this.cluePage + 1); this.drawInterface(); },
            0x52627e, false, this.cluePage >= pageCount - 1
        );
        this.addText(container, 16, navY + 82, "Astuce : passe d'un onglet à l'autre pour consulter le plateau et accuser un suspect.",
            10, COLORS.muted, false, 0, { wordWrap: { width: width - 32 } });
    }

    private drawMobileAccuseTab(
        container: Phaser.GameObjects.Container,
        width: number,
        _height: number
    ): void {
        if (!this.currentCase) return;
        const people = this.currentCase.puzzle.people;
        const suspects = people.filter(person => person.role === "suspect");
        const allPlaced = people.every(person => Boolean(this.playerPositions[person.id]));
        const placedCount = Object.keys(this.playerPositions).length;

        this.addText(container, 16, 150, "VOTRE ACCUSATION", 15, "#edf2fa", true, 0.5);
        this.addText(container, 16, 176, `${placedCount}/${people.length} personnages placés`, 11, COLORS.muted);

        if (!allPlaced) {
            const info = this.add.rectangle(width / 2, 245, width - 32, 88, 0x1b263a, 1)
                .setStrokeStyle(1, 0x34435f, 1);
            container.add(info);
            this.addText(container, width / 2, 245,
                "Place d'abord tous les personnages dans l'onglet PLATEAU.",
                12, "#d5dfef", true, 0, { align: "center", wordWrap: { width: width - 64 } }
            ).setOrigin(0.5);
        } else {
            this.addText(container, 16, 215, "Qui se trouvait dans la pièce de la victime ?", 12, "#cbd6e9");
            const columns = 2;
            const gap = 9;
            const margin = 14;
            const buttonWidth = (width - margin * 2 - gap) / 2;
            const buttonHeight = 50;
            suspects.forEach((suspect, index) => {
                const col = index % columns;
                const row = Math.floor(index / columns);
                this.addButton(container, suspect.name,
                    margin + col * (buttonWidth + gap), 250 + row * (buttonHeight + 10),
                    buttonWidth, buttonHeight,
                    () => {
                        this.selectedAccusedId = suspect.id;
                        this.statusMessage = `Tu accuses ${suspect.name}. Confirme ton enquête.`;
                        this.statusColor = "#e8cd8a";
                        this.drawInterface();
                    },
                    this.selectedAccusedId === suspect.id ? COLORS.gold : 0x52627e,
                    this.selectedAccusedId === suspect.id
                );
            });
            const rows = Math.ceil(suspects.length / columns);
            const buttonY = 250 + rows * (buttonHeight + 10) + 14;
            this.addButton(container, "VALIDER L'ACCUSATION", 14, buttonY, width - 28, 48,
                () => this.validateAttempt(), COLORS.accent, true,
                !this.selectedAccusedId || this.finished
            );
            this.addText(container, 16, buttonY + 68, this.statusMessage, 11, this.statusColor, true, 0,
                { wordWrap: { width: width - 32 } });
        }
        this.addButton(container, "RETOUR AU PLATEAU", 14, this.scale.height - 62, width - 28, 44,
            () => { this.mobileTab = "board"; this.drawInterface(); }, 0x52627e, false);
    }

    private drawBackdrop(container: Phaser.GameObjects.Container): void {
        const graphics = this.add.graphics();
        graphics.fillStyle(COLORS.background, 1);
        graphics.fillRect(0, 0, WIDTH, HEIGHT);
        graphics.fillStyle(0x17233a, 0.35);
        graphics.fillCircle(90, 120, 260);
        graphics.fillStyle(0x1c1834, 0.30);
        graphics.fillCircle(1370, 850, 300);
        graphics.lineStyle(1, 0x24314a, 0.2);
        for (let x = 0; x < WIDTH; x += 64) graphics.lineBetween(x, 0, x, HEIGHT);
        for (let y = 0; y < HEIGHT; y += 64) graphics.lineBetween(0, y, WIDTH, y);
        container.add(graphics);
    }

    private drawPanel(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        width: number,
        height: number
    ): void {
        const panel = this.add.rectangle(x + width / 2, y + height / 2, width, height, COLORS.panel, 0.98)
            .setStrokeStyle(1, COLORS.border, 1);
        container.add(panel);
        const topAccent = this.add.rectangle(x + width / 2, y + 2, width - 2, 3, 0x6f91d2, 0.75);
        container.add(topAccent);
    }

    private drawBoard(container: Phaser.GameObjects.Container): void {
        if (!this.currentCase) return;
        const board = this.currentCase.puzzle.board;
        const gridMax = 440;
        const cellSize = Math.min(92, gridMax / board.size);
        const boardWidth = cellSize * board.size;
        const startX = 92 + (500 - boardWidth) / 2;
        const startY = 218;
        const graphics = this.add.graphics();
        container.add(graphics);

        // Case par case.
        for (let row = 0; row < board.size; row++) {
            for (let col = 0; col < board.size; col++) {
                const cell = board.cells[row][col];
                const room = board.rooms.find(item => item.id === cell.roomId);
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;
                const color = room
                    ? Phaser.Display.Color.HexStringToColor(room.color).color
                    : 0x596174;

                graphics.fillStyle(color, 0.94);
                graphics.fillRoundedRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 8);
                graphics.lineStyle(1, 0xffffff, 0.16);
                graphics.strokeRoundedRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 8);

                const object = board.objects.find(item =>
                    item.position.row === row && item.position.col === col
                );
                if (object && !object.occupiable) {
                    graphics.fillStyle(0x0b1020, 0.23);
                    graphics.fillRoundedRect(x + 4, y + 4, cellSize - 8, cellSize - 8, 7);
                }

                const hitArea = this.add.rectangle(
                    x + cellSize / 2,
                    y + cellSize / 2,
                    cellSize - 4,
                    cellSize - 4,
                    0xffffff,
                    0.001
                );
                hitArea.setInteractive({ useHandCursor: true });
                hitArea.on("pointerdown", () => this.handleCellClick(row, col));
                container.add(hitArea);

                if (object) {
                    this.addText(
                        container,
                        x + cellSize / 2,
                        y + cellSize - 8,
                        this.getObjectShortName(object.name),
                        Math.max(9, Math.min(12, cellSize / 7)),
                        object.occupiable ? "#243149" : "#f7f8fb",
                        true
                    ).setOrigin(0.5, 1);
                }

                const placed = this.getPersonAt(row, col);
                if (placed) {
                    const isVictim = placed.role === "victim";
                    const cx = x + cellSize / 2;
                    const cy = y + cellSize / 2 - (object ? 5 : 0);
                    const radius = Math.min(27, cellSize * 0.28);
                    const shadow = this.add.circle(cx + 1, cy + 3, radius + 2, 0x08101e, 0.38);
                    const marker = this.add.circle(cx, cy, radius, isVictim ? 0xa84e61 : 0x263b5e)
                        .setStrokeStyle(2.5, 0xffffff, 0.95);
                    container.add([shadow, marker]);
                    const personIndex = this.currentCase.puzzle.people
                        .filter(person => person.role === "suspect")
                        .findIndex(person => person.id === placed.id);
                    this.addText(container, cx, cy, isVictim ? "V" : `S${personIndex + 1}`, 16, "#ffffff", true)
                        .setOrigin(0.5);
                }
            }
        }

        // Noms de pièces : une étiquette par pièce, placée sur une case libre si possible.
        for (const room of board.rooms) {
            const roomCells: Position[] = [];
            for (let row = 0; row < board.size; row++) {
                for (let col = 0; col < board.size; col++) {
                    if (board.cells[row][col].roomId === room.id) roomCells.push({ row, col });
                }
            }
            if (roomCells.length === 0) continue;
            const candidates = roomCells.filter(position =>
                !board.objects.some(object => object.position.row === position.row && object.position.col === position.col) &&
                !this.playerPositionsHasCell(position)
            );
            const targetCells = candidates.length ? candidates : roomCells;
            const target = targetCells[Math.floor(targetCells.length / 2)];
            const x = startX + (target.col + 0.5) * cellSize;
            const y = startY + 17 + target.row * cellSize;
            const roomColor = Phaser.Display.Color.HexStringToColor(room.color).color;
            const labelWidth = Math.min(cellSize - 8, Math.max(48, room.name.length * 6.2 + 12));
            const bg = this.add.rectangle(x, y, labelWidth, 19, 0x111a2b, 0.88)
                .setStrokeStyle(1, roomColor, 0.95);
            container.add(bg);
            this.addText(container, x, y, room.name, 9, "#f5f7fb", true).setOrigin(0.5);
        }

        // Séparations entre les pièces.
        graphics.lineStyle(4, 0x172033, 1);
        for (let row = 0; row < board.size; row++) {
            for (let col = 0; col < board.size; col++) {
                const roomId = board.cells[row][col].roomId;
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;
                if (col === board.size - 1 || roomId !== board.cells[row][col + 1]?.roomId) {
                    graphics.lineBetween(x + cellSize, y, x + cellSize, y + cellSize);
                }
                if (row === board.size - 1 || roomId !== board.cells[row + 1]?.[col]?.roomId) {
                    graphics.lineBetween(x, y + cellSize, x + cellSize, y + cellSize);
                }
            }
        }
        graphics.lineStyle(3, 0x2e3d59, 1);
        graphics.strokeRoundedRect(startX, startY, boardWidth, boardWidth, 5);

        this.drawLegend(container, board.rooms, startX, startY + boardWidth + 18, boardWidth);
    }

    private drawLegend(
        container: Phaser.GameObjects.Container,
        rooms: Array<{ id: string; name: string; color: string }>,
        x: number,
        y: number,
        width: number
    ): void {
        const columns = 3;
        const itemWidth = width / columns;
        rooms.forEach((room, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const ix = x + col * itemWidth + 8;
            const iy = y + row * 25;
            const color = Phaser.Display.Color.HexStringToColor(room.color).color;
            const swatch = this.add.rectangle(ix, iy + 7, 12, 12, color).setStrokeStyle(1, 0xffffff, 0.35);
            container.add(swatch);
            this.addText(container, ix + 12, iy, room.name, 10, "#acb8cd").setOrigin(0, 0);
        });
    }

    private drawCharacterPicker(container: Phaser.GameObjects.Container): void {
        if (!this.currentCase) return;
        const people = this.currentCase.puzzle.people;
        const y = 790;
        this.addText(container, 72, 744, "PERSONNAGES", 12, "#9baac4", true, 1);
        const gap = 7;
        const buttonWidth = 500 / people.length - gap;
        people.forEach((person, index) => {
            const suspectIndex = people.filter(item => item.role === "suspect").findIndex(item => item.id === person.id);
            const label = person.role === "victim" ? "VICTIME" : `S${suspectIndex + 1}`;
            const selected = this.selectedPersonId === person.id;
            const placed = Boolean(this.playerPositions[person.id]);
            const color = person.role === "victim" ? 0xb35b6a : (selected ? COLORS.accent : 0x52627e);
            this.addButton(
                container,
                `${label}${placed ? " ✓" : ""}`,
                70 + index * (buttonWidth + gap),
                y,
                buttonWidth,
                42,
                () => {
                    this.selectedPersonId = person.id;
                    this.statusMessage = `${person.name} sélectionné(e). Choisis sa case.`;
                    this.statusColor = "#c2d1e8";
                    this.drawInterface();
                },
                color,
                selected
            );
        });
        this.addText(container, 72, 847,
            `Placés : ${Object.keys(this.playerPositions).length}/${people.length}  •  Sélection : ${people.find(p => p.id === this.selectedPersonId)?.name ?? "—"}`,
            11,
            COLORS.muted
        );
        this.addButton(container, "EFFACER", 72, 875, 125, 32, () => this.clearSelectedPlacement(), 0x586783, false,
            !this.selectedPersonId || !this.playerPositions[this.selectedPersonId]);
        this.addButton(container, "TOUT RECOMMENCER", 208, 875, 165, 32, () => this.resetPlayerPlacements(), 0x586783, false,
            Object.keys(this.playerPositions).length === 0);
    }

    private drawClues(container: Phaser.GameObjects.Container): void {
        if (!this.currentCase) return;
        const puzzle = this.currentCase.puzzle;
        const orderedClues = this.getCluesOrderedBySuspect();
        const pageCount = Math.max(1, Math.ceil(orderedClues.length / this.cluePageSize));
        this.cluePage = Phaser.Math.Clamp(this.cluePage, 0, pageCount - 1);
        const start = this.cluePage * this.cluePageSize;
        const visible = orderedClues.slice(start, start + this.cluePageSize);
        const x = 690;
        const width = 680;
        const y = 205;
        const cardHeight = 65;
        const gap = 9;

        visible.forEach((clue, index) => {
            const currentY = y + index * (cardHeight + gap);
            const person = puzzle.people.find(item => item.id === clue.personId);
            const personNumber = person?.role === "victim"
                ? "V"
                : `S${puzzle.people.filter(item => item.role === "suspect").findIndex(item => item.id === person?.id) + 1}`;
            const card = this.add.rectangle(x + width / 2, currentY + cardHeight / 2, width, cardHeight, 0x1b263a, 1)
                .setStrokeStyle(1, 0x34435f, 1);
            container.add(card);
            const badge = this.add.rectangle(x + 28, currentY + 22, 34, 25,
                person?.role === "victim" ? 0x9c4d60 : 0x314a70, 1);
            container.add(badge);
            this.addText(container, x + 28, currentY + 22, personNumber, 12, "#f2f5fa", true).setOrigin(0.5);
            this.addText(container, x + 55, currentY + 10,
                `${start + index + 1}. ${person?.name ?? "Personnage"}`,
                11,
                "#a9c1e8",
                true
            );
            this.addText(container, x + 55, currentY + 31, clue.description, 13, "#e8edf6", false, 0, {
                wordWrap: { width: width - 75 },
                lineSpacing: 2
            });
        });

        const paginationY = Math.max(635, y + visible.length * (cardHeight + gap) + 7);
        this.addText(container, 1030, paginationY, `INDICES ${orderedClues.length ? start + 1 : 0}–${Math.min(start + visible.length, orderedClues.length)} / ${orderedClues.length}   •   PAGE ${this.cluePage + 1}/${pageCount}`,
            10, "#8594af", true, 0.8).setOrigin(0.5);
        this.addButton(container, "← PRÉCÉDENTS", 780, paginationY + 24, 155, 34,
            () => { this.cluePage = Math.max(0, this.cluePage - 1); this.drawInterface(); },
            0x4f607d, false, this.cluePage === 0);
        this.addButton(container, "SUIVANTS →", 1120, paginationY + 24, 155, 34,
            () => { this.cluePage = Math.min(pageCount - 1, this.cluePage + 1); this.drawInterface(); },
            0x4f607d, false, this.cluePage >= pageCount - 1);
    }

    private drawAccusation(container: Phaser.GameObjects.Container): void {
        if (!this.currentCase) return;
        const suspects = this.currentCase.puzzle.people.filter(person => person.role === "suspect");
        const allPlaced = this.currentCase.puzzle.people.every(person => Boolean(this.playerPositions[person.id]));
        this.addText(container, 690, 775, "VOTRE ACCUSATION", 12, "#9baac4", true, 1);
        const gap = 8;
        const totalWidth = 680;
        const buttonWidth = (totalWidth - gap * (suspects.length - 1)) / suspects.length;
        suspects.forEach((suspect, index) => {
            this.addButton(
                container,
                suspect.name,
                690 + index * (buttonWidth + gap),
                800,
                buttonWidth,
                40,
                () => {
                    this.selectedAccusedId = suspect.id;
                    this.statusMessage = `Tu accuses ${suspect.name}. Confirme ton accusation.`;
                    this.statusColor = "#e8cd8a";
                    this.drawInterface();
                },
                this.selectedAccusedId === suspect.id ? COLORS.gold : 0x52627e,
                this.selectedAccusedId === suspect.id,
                !allPlaced || this.finished
            );
        });
        this.addButton(
            container,
            this.finished ? "AFFAIRE RÉSOLUE ✓" : "VALIDER L'ACCUSATION",
            900,
            858,
            260,
            43,
            () => this.validateAttempt(),
            this.finished ? COLORS.green : COLORS.accent,
            true,
            !allPlaced || !this.selectedAccusedId || this.finished
        );
    }

    private drawStatus(container: Phaser.GameObjects.Container): void {
        const status = this.addText(container, WIDTH / 2, 930, this.statusMessage, 12, this.statusColor, true);
        status.setOrigin(0.5);
    }

    private getCluesOrderedBySuspect(): Clue[] {
        if (!this.currentCase) return [];
        const peopleOrder = new Map(this.currentCase.puzzle.people.map((person, index) => [person.id, index]));
        return this.currentCase.puzzle.clues
            .map((clue, index) => ({ clue, index }))
            .sort((a, b) => {
                const orderA = peopleOrder.get(a.clue.personId) ?? Number.MAX_SAFE_INTEGER;
                const orderB = peopleOrder.get(b.clue.personId) ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB || a.index - b.index;
            })
            .map(entry => entry.clue);
    }

    private getPersonAt(row: number, col: number): Person | undefined {
        if (!this.currentCase) return undefined;
        return this.currentCase.puzzle.people.find(person => {
            const position = this.playerPositions[person.id];
            return position?.row === row && position?.col === col;
        });
    }

    private playerPositionsHasCell(position: Position): boolean {
        return Object.values(this.playerPositions).some(
            placed => placed.row === position.row && placed.col === position.col
        );
    }

    private handleCellClick(row: number, col: number): void {
        if (!this.currentCase || !this.selectedPersonId || this.finished) return;
        const board = this.currentCase.puzzle.board;
        const person = this.currentCase.puzzle.people.find(item => item.id === this.selectedPersonId);
        const cell = board.cells[row]?.[col];
        if (!person || !cell) return;

        const objects = board.objects.filter(object => object.position.row === row && object.position.col === col);
        if (cell.blocked || objects.some(object => !object.occupiable)) {
            this.statusMessage = "Cette case est bloquée par un meuble.";
            this.statusColor = "#e6a0a0";
            this.drawInterface();
            return;
        }

        const conflict = this.currentCase.puzzle.people.find(other => {
            if (other.id === this.selectedPersonId) return false;
            const position = this.playerPositions[other.id];
            return position && (position.row === row || position.col === col);
        });
        if (conflict) {
            this.statusMessage = `${conflict.name} occupe déjà cette ligne ou cette colonne.`;
            this.statusColor = "#e6a0a0";
            this.drawInterface();
            return;
        }

        this.playerPositions[this.selectedPersonId] = { row, col };
        this.selectedAccusedId = null;
        this.statusMessage = `${person.name} placé(e).`;
        this.statusColor = "#91d6b4";
        const next = this.currentCase.puzzle.people.find(item => !this.playerPositions[item.id]);
        this.selectedPersonId = next?.id ?? this.selectedPersonId;
        this.drawInterface();
    }

    private clearSelectedPlacement(): void {
        if (!this.selectedPersonId) return;
        delete this.playerPositions[this.selectedPersonId];
        this.selectedAccusedId = null;
        this.statusMessage = "Placement effacé.";
        this.statusColor = "#aab7ce";
        this.drawInterface();
    }

    private resetPlayerPlacements(): void {
        if (!this.currentCase) return;
        this.playerPositions = {};
        this.selectedPersonId = this.currentCase.puzzle.people.find(person => person.role === "suspect")?.id ?? null;
        this.selectedAccusedId = null;
        this.statusMessage = "Tous les placements ont été effacés.";
        this.statusColor = "#aab7ce";
        this.drawInterface();
    }

    private validateAttempt(): void {
        if (!this.currentCase) return;
        const { board, people, clues } = this.currentCase.puzzle;
        const allPlaced = people.every(person => Boolean(this.playerPositions[person.id]));
        if (!allPlaced) {
            this.setStatus("Il reste des personnages à placer.", "#e6a0a0");
            return;
        }
        if (!this.selectedAccusedId) {
            this.setStatus("Choisis d'abord le suspect que tu accuses.", "#e6a0a0");
            return;
        }

        const inBounds = (p: Position): boolean =>
            Number.isInteger(p.row) && Number.isInteger(p.col) &&
            p.row >= 0 && p.row < board.size && p.col >= 0 && p.col < board.size;
        const roomAt = (p: Position): string | null =>
            inBounds(p) ? board.cells[p.row]?.[p.col]?.roomId ?? null : null;
        const areAdjacent = (a: Position, b: Position): boolean =>
            inBounds(a) && inBounds(b) &&
            Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

        const rows = new Set<number>();
        const cols = new Set<number>();
        const cells = new Set<string>();
        for (const person of people) {
            const position = this.playerPositions[person.id];
            if (!position || !inBounds(position)) {
                this.setStatus(`Position invalide pour ${person.name}.`, "#e6a0a0");
                return;
            }
            const cell = board.cells[position.row][position.col];
            const blocking = board.objects.some(object =>
                object.position.row === position.row && object.position.col === position.col && !object.occupiable
            );
            if (!cell || cell.blocked || blocking) {
                this.setStatus(`${person.name} est sur une case bloquée.`, "#e6a0a0");
                return;
            }
            const key = `${position.row}-${position.col}`;
            if (cells.has(key) || rows.has(position.row) || cols.has(position.col)) {
                this.setStatus("Une ligne et une colonne ne peuvent contenir qu'une personne.", "#e6a0a0");
                return;
            }
            cells.add(key);
            rows.add(position.row);
            cols.add(position.col);
        }

        const violated: number[] = [];
        clues.forEach((clue, index) => {
            const position = this.playerPositions[clue.personId];
            const rule = clue.rule;
            let satisfied = false;
            switch (rule.type) {
                case "in-room":
                    satisfied = roomAt(position) === rule.roomId;
                    break;
                case "not-in-room":
                    satisfied = roomAt(position) !== null && roomAt(position) !== rule.roomId;
                    break;
                case "same-room-as":
                    satisfied = Boolean(this.playerPositions[rule.personId] && roomAt(position) === roomAt(this.playerPositions[rule.personId]));
                    break;
                case "different-room-from":
                    satisfied = Boolean(this.playerPositions[rule.personId] && roomAt(position) !== roomAt(this.playerPositions[rule.personId]));
                    break;
                case "beside-person":
                    satisfied = Boolean(this.playerPositions[rule.personId] && areAdjacent(position, this.playerPositions[rule.personId]));
                    break;
                case "relative-to-person": {
                    const other = this.playerPositions[rule.personId];
                    if (!other) break;
                    switch (rule.direction) {
                        case "north": satisfied = position.row < other.row; break;
                        case "south": satisfied = position.row > other.row; break;
                        case "east": satisfied = position.col > other.col; break;
                        case "west": satisfied = position.col < other.col; break;
                    }
                    break;
                }
                case "on-object": {
                    const object = board.objects.find(item => item.id === rule.objectId);
                    satisfied = Boolean(object && position.row === object.position.row && position.col === object.position.col);
                    break;
                }
                case "beside-object": {
                    const object = board.objects.find(item => item.id === rule.objectId);
                    satisfied = Boolean(object && areAdjacent(position, object.position));
                    break;
                }
                case "on-row":
                    satisfied = position.row === rule.row;
                    break;
                case "on-column":
                    satisfied = position.col === rule.col;
                    break;
            }
            if (!satisfied) violated.push(index + 1);
        });

        if (violated.length) {
            this.setStatus(`Indices non respectés : ${violated.map(index => `#${index}`).join(", ")}.`, "#e6a0a0");
            return;
        }

        const victim = people.find(person => person.role === "victim");
        if (!victim) {
            this.setStatus("Cette affaire ne contient pas de victime.", "#e6a0a0");
            return;
        }
        const victimRoom = roomAt(this.playerPositions[victim.id]);
        const suspectsInVictimRoom = people.filter(person =>
            person.role === "suspect" && roomAt(this.playerPositions[person.id]) === victimRoom
        );
        if (suspectsInVictimRoom.length !== 1) {
            this.setStatus("La pièce de la victime doit contenir exactement un suspect.", "#e6a0a0");
            return;
        }

        const murderer = suspectsInVictimRoom[0];
        if (this.selectedAccusedId !== murderer.id) {
            this.setStatus("Les indices sont respectés, mais ton accusation n'est pas la bonne.", "#e6a0a0");
            return;
        }

        this.finished = true;
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
        this.scene.start("ResultScene", {
            difficulty: this.difficulty,
            caseId: this.currentCase.puzzle.id,
            clueCount: clues.length,
            elapsedSeconds,
            murdererName: murderer.name
        });
    }

    private setStatus(message: string, color: string): void {
        this.statusMessage = message;
        this.statusColor = color;
        this.drawInterface();
    }

    private drawPill(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        label: string,
        color: number,
        width: number
    ): void {
        const bg = this.add.rectangle(x + width / 2, y, width, 30, color, 0.15)
            .setStrokeStyle(1, color, 0.7);
        container.add(bg);
        this.addText(container, x + width / 2, y, label, 10, "#e8eef9", true, 0.6).setOrigin(0.5);
    }

    private addText(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        text: string,
        fontSize: number,
        color: string,
        bold = false,
        letterSpacing = 0,
        extra: Phaser.Types.GameObjects.Text.TextStyle = {}
    ): Phaser.GameObjects.Text {
        const object = this.add.text(x, y, text, {
            fontFamily: "Arial, sans-serif",
            fontSize: `${fontSize}px`,
            color,
            fontStyle: bold ? "bold" : "normal",
            letterSpacing,
            ...extra
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
        selected = false,
        disabled = false
    ): void {
        const bg = this.add.rectangle(x + width / 2, y + height / 2, width, height,
            disabled ? 0x202a3d : selected ? color : 0x26344e, 1)
            .setStrokeStyle(1, disabled ? 0x303b50 : color, disabled ? 0.35 : 0.7);
        if (!disabled) {
            bg.setInteractive({ useHandCursor: true });
            bg.on("pointerover", () => bg.setAlpha(0.82));
            bg.on("pointerout", () => bg.setAlpha(1));
            bg.on("pointerdown", callback);
        }
        container.add(bg);
        this.addText(container, x + width / 2, y + height / 2, label, 11,
            disabled ? "#67738a" : selected ? "#101827" : "#e9eef7", true, 0.3,
            { align: "center", wordWrap: { width: width - 12 } }
        ).setOrigin(0.5);
    }

    private getObjectShortName(name: string): string {
        const names: Record<string, string> = {
            "Télévision": "TV",
            "Étagère": "Étagère",
            "Armoire": "Armoire",
            "Canapé": "Canapé",
            "Fauteuil": "Fauteuil",
            "Chaise": "Chaise",
            "Table": "Table",
            "Plante": "Plante",
            "Statue": "Statue",
            "Lampe": "Lampe",
            "Piano": "Piano",
            "Tapis": "Tapis",
            "Lit": "Lit"
        };
        return names[name] ?? name;
    }
}
