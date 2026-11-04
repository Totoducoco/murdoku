import type {
    Board,
    Cell,
    Position,
    Room
} from "../model/types";
import { ROOM_TEMPLATES } from "../data/rooms";

export type BoardGenerationOptions = {
    size: number;
    roomCount?: number;
    roomTemplates?: readonly Room[];
    seed?: number;
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

function randomInt(random: () => number, min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
}

function getNeighbors(position: Position, size: number): Position[] {
    const directions: Position[] = [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 }
    ];

    return directions
        .map(direction => ({
            row: position.row + direction.row,
            col: position.col + direction.col
        }))
        .filter(neighbor =>
            neighbor.row >= 0 && neighbor.row < size &&
            neighbor.col >= 0 && neighbor.col < size
        );
}

function manhattanDistance(a: Position, b: Position): number {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function generateRoomSeeds(
    size: number,
    roomCount: number,
    random: () => number
): Position[] {
    const seeds: Position[] = [{
        row: randomInt(random, 0, size - 1),
        col: randomInt(random, 0, size - 1)
    }];

    while (seeds.length < roomCount) {
        let candidates: Position[] = [];
        let bestDistance = -1;

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const candidate = { row, col };
                if (seeds.some(seed => seed.row === row && seed.col === col)) continue;

                const minDistance = Math.min(
                    ...seeds.map(seed => manhattanDistance(candidate, seed))
                );

                if (minDistance > bestDistance) {
                    bestDistance = minDistance;
                    candidates = [candidate];
                } else if (minDistance === bestDistance) {
                    candidates.push(candidate);
                }
            }
        }

        if (candidates.length === 0) break;
        seeds.push(candidates[randomInt(random, 0, candidates.length - 1)]);
    }

    return seeds;
}

function getRoomFrontier(
    roomId: string,
    assignments: (string | null)[][],
    size: number
): Position[] {
    const frontier = new Map<string, Position>();

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (assignments[row][col] !== roomId) continue;

            for (const neighbor of getNeighbors({ row, col }, size)) {
                if (assignments[neighbor.row][neighbor.col] === null) {
                    frontier.set(`${neighbor.row}-${neighbor.col}`, neighbor);
                }
            }
        }
    }

    return [...frontier.values()];
}

function distributeRooms(
    size: number,
    rooms: Room[],
    seeds: Position[],
    random: () => number
): string[][] {
    const assignments: (string | null)[][] = Array.from(
        { length: size },
        () => Array(size).fill(null)
    );
    const roomSizes = rooms.map(() => 0);

    seeds.forEach((seed, index) => {
        assignments[seed.row][seed.col] = rooms[index].id;
        roomSizes[index]++;
    });

    let remaining = size * size - seeds.length;

    while (remaining > 0) {
        const availableRooms = rooms
            .map((room, index) => ({
                room,
                index,
                frontier: getRoomFrontier(room.id, assignments, size)
            }))
            .filter(entry => entry.frontier.length > 0);

        if (availableRooms.length === 0) {
            throw new Error("Impossible de terminer la génération du plateau.");
        }

        const smallestSize = Math.min(
            ...availableRooms.map(entry => roomSizes[entry.index])
        );

        const candidates = availableRooms.filter(
            entry => roomSizes[entry.index] === smallestSize
        );

        const selectedRoom = candidates[
            randomInt(random, 0, candidates.length - 1)
        ];
        const selectedCell = selectedRoom.frontier[
            randomInt(random, 0, selectedRoom.frontier.length - 1)
        ];

        assignments[selectedCell.row][selectedCell.col] = selectedRoom.room.id;
        roomSizes[selectedRoom.index]++;
        remaining--;
    }

    return assignments.map(row => row.map(roomId => roomId!));
}

/** Génère une grille carrée découpée en pièces connexes. */
export function generateBoard(options: BoardGenerationOptions): Board {
    const { size, seed, roomTemplates } = options;

    if (!Number.isInteger(size) || size < 3 || size > 12) {
        throw new Error("La taille du plateau doit être comprise entre 3 et 12.");
    }

    const random = createRandom(seed);
    const requestedRoomCount = options.roomCount ??
        Math.min(8, Math.max(3, Math.floor(size * size / 6)));

    if (
        !Number.isInteger(requestedRoomCount) ||
        requestedRoomCount < 2 ||
        requestedRoomCount > size * size
    ) {
        throw new Error("Nombre de pièces invalide.");
    }

    const templates = roomTemplates?.length ? roomTemplates : ROOM_TEMPLATES;
    const rooms: Room[] = Array.from({ length: requestedRoomCount }, (_, index) => {
        const template = templates[index % templates.length];
        return { ...template, id: `${template.id}-${index + 1}` };
    });

    const seeds = generateRoomSeeds(size, requestedRoomCount, random);
    const assignments = distributeRooms(size, rooms, seeds, random);

    const cells: Cell[][] = Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => ({
            position: { row, col },
            roomId: assignments[row][col],
            objectIds: [],
            blocked: false
        }))
    );

    return { size, cells, rooms, objects: [] };
}
