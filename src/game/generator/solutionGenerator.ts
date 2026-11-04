import type { Board, Person, Position, PuzzleSolution } from "../model/types";

export type SolutionGenerationOptions = {
    suspectNames?: string[];
    victimName?: string;
    seed?: number;
    maxAttempts?: number;
};

export type GeneratedSolution = {
    people: Person[];
    solution: PuzzleSolution;
};

function createRandom(seed?: number): () => number {
    if (seed === undefined) return Math.random;
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle<T>(array: T[], random: () => number): T[] {
    const result = [...array];
    for (let index = result.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

function isCellOccupable(board: Board, position: Position): boolean {
    const cell = board.cells[position.row]?.[position.col];
    if (!cell || cell.blocked) return false;

    const referencedObjects = cell.objectIds.map(id =>
        board.objects.find(object => object.id === id)
    );

    if (referencedObjects.some(object => !object)) return false;
    if (referencedObjects.some(object => object !== undefined && !object.occupiable)) {
        return false;
    }

    const objectsAtPosition = board.objects.filter(
        object =>
            object.position.row === position.row &&
            object.position.col === position.col
    );

    return objectsAtPosition.every(object => object.occupiable);
}

function validatePlacement(
    people: Person[],
    positions: Record<string, Position>,
    board: Board
): boolean {
    if (people.length !== board.size) return false;

    const usedRows = new Set<number>();
    const usedCols = new Set<number>();

    for (const person of people) {
        const position = positions[person.id];
        if (!position) return false;

        if (
            !Number.isInteger(position.row) ||
            !Number.isInteger(position.col) ||
            position.row < 0 || position.row >= board.size ||
            position.col < 0 || position.col >= board.size
        ) {
            return false;
        }

        if (!isCellOccupable(board, position)) return false;
        if (usedRows.has(position.row) || usedCols.has(position.col)) return false;

        usedRows.add(position.row);
        usedCols.add(position.col);
    }

    return usedRows.size === board.size && usedCols.size === board.size;
}

function findMurderer(
    people: Person[],
    positions: Record<string, Position>,
    board: Board
): string | null {
    const victim = people.find(person => person.role === "victim");
    if (!victim) return null;

    const victimPosition = positions[victim.id];
    const victimCell = board.cells[victimPosition.row]?.[victimPosition.col];
    if (!victimCell) return null;

    const suspectsInVictimRoom = people.filter(person => {
        if (person.role !== "suspect") return false;
        const position = positions[person.id];
        const cell = board.cells[position.row]?.[position.col];
        return cell?.roomId === victimCell.roomId;
    });

    return suspectsInVictimRoom.length === 1
        ? suspectsInVictimRoom[0].id
        : null;
}

/** Place une victime et les suspects, avec une personne par ligne et colonne. */
export function generateSolution(
    board: Board,
    options: SolutionGenerationOptions = {}
): GeneratedSolution {
    if (
        !Number.isInteger(board.size) ||
        board.size < 2 ||
        board.cells.length !== board.size ||
        board.cells.some(row => row.length !== board.size)
    ) {
        throw new Error("Le plateau fourni est invalide.");
    }

    if (
        board.rooms.length === 0 ||
        board.cells.some(row => row.some(cell => !board.rooms.some(room => room.id === cell.roomId)))
    ) {
        throw new Error("Le plateau contient des pièces manquantes ou inconnues.");
    }

    const suspectCount = board.size - 1;
    const suspectNames = options.suspectNames ??
        Array.from({ length: suspectCount }, (_, index) => `Suspect ${index + 1}`);
    const victimName = options.victimName ?? "Victime";

    if (suspectNames.length !== suspectCount) {
        throw new Error(
            `Une grille ${board.size} × ${board.size} nécessite exactement ${suspectCount} suspects et une victime.`
        );
    }

    const allNames = [...suspectNames, victimName].map(name => name.trim());
    if (
        allNames.some(name => name.length === 0) ||
        new Set(allNames.map(name => name.toLowerCase())).size !== allNames.length
    ) {
        throw new Error("Les noms des personnages doivent être non vides et uniques.");
    }

    const people: Person[] = [
        ...suspectNames.map((name, index): Person => ({
            id: `suspect-${index + 1}`,
            name: name.trim(),
            role: "suspect"
        })),
        { id: "victim", name: victimName.trim(), role: "victim" }
    ];

    const random = createRandom(options.seed);
    const maxAttempts = options.maxAttempts ?? 10000;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        throw new Error("Le nombre de tentatives doit être positif.");
    }

    const columns = Array.from({ length: board.size }, (_, index) => index);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const shuffledPeople = shuffle(people, random);
        const shuffledColumns = shuffle(columns, random);
        const positions: Record<string, Position> = {};

        for (let row = 0; row < board.size; row++) {
            positions[shuffledPeople[row].id] = {
                row,
                col: shuffledColumns[row]
            };
        }

        if (!validatePlacement(people, positions, board)) continue;

        const murdererId = findMurderer(people, positions, board);
        if (!murdererId) continue;

        return {
            people,
            solution: { positions, murdererId }
        };
    }

    throw new Error(
        `Impossible de trouver une solution valide après ${maxAttempts} tentatives. Essaie une autre grille ou une autre graine.`
    );
}
