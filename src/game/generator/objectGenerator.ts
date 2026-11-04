import type {
    Board,
    Person,
    Position,
    PuzzleSolution,
    SceneObject
} from "../model/types";
import {
    BLOCKING_OBJECTS,
    OCCUPIABLE_OBJECTS,
    type ObjectTemplate
} from "../data/objects";

export type ObjectGenerationOptions = {
    seed?: number;
    /** Probabilité de placer un objet occupable sous un personnage. */
    occupiableChance?: number;
    /** Nombre maximum d'objets bloquants ajouté par pièce. */
    maxBlockingObjectsPerRoom?: number;
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

function shuffle<T>(values: T[], random: () => number): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
        const other = randomInt(random, 0, index);
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

const normalizeObjectName = (name: string): string =>
    name.trim().toLocaleLowerCase("fr-FR");

/**
 * Ajoute du mobilier au plateau sans invalider la solution fournie.
 *
 * IMPORTANT :
 * - Les noms d'objets peuvent être répétés dans différentes pièces.
 * - Chaque instance reçoit un id technique unique (object-1, object-2, ...).
 * - Dans une même pièce, un nom n'est placé qu'une fois afin que l'indice
 *   « la Table dans le Salon » désigne un objet visible sans ambiguïté.
 * - Les identifiants ne sont jamais destinés à être affichés au joueur.
 */
export function generateSceneObjects(
    board: Board,
    people: Person[],
    solution: PuzzleSolution,
    options: ObjectGenerationOptions = {}
): Board {
    const random = createRandom(options.seed);
    const occupiableChance = options.occupiableChance ?? 0.55;
    const maxBlockingObjectsPerRoom = options.maxBlockingObjectsPerRoom ?? 2;

    if (occupiableChance < 0 || occupiableChance > 1) {
        throw new Error("occupiableChance doit être compris entre 0 et 1.");
    }
    if (!Number.isInteger(maxBlockingObjectsPerRoom) || maxBlockingObjectsPerRoom < 0) {
        throw new Error("maxBlockingObjectsPerRoom doit être un entier positif ou nul.");
    }

    const result: Board = {
        ...board,
        cells: board.cells.map(row => row.map(cell => ({
            ...cell,
            position: { ...cell.position },
            objectIds: [...cell.objectIds]
        }))),
        rooms: board.rooms.map(room => ({ ...room })),
        objects: board.objects.map(object => ({
            ...object,
            position: { ...object.position }
        }))
    };

    const occupiedKeys = new Set<string>();
    for (const person of people) {
        const position = solution.positions[person.id];
        if (!position) throw new Error(`Position absente pour ${person.name}.`);

        const cell = result.cells[position.row]?.[position.col];
        if (!cell || cell.blocked) {
            throw new Error(`Position invalide pour ${person.name}.`);
        }
        occupiedKeys.add(`${position.row}-${position.col}`);
    }

    const usedObjectCells = new Set<string>(
        result.objects.map(object => `${object.position.row}-${object.position.col}`)
    );
    const usedObjectIds = new Set<string>(result.objects.map(object => object.id));

    // On autorise les doublons de noms entre pièces, mais pas dans une même pièce.
    const usedNamesByRoom = new Map<string, Set<string>>();
    const getRoomNames = (roomId: string): Set<string> => {
        let names = usedNamesByRoom.get(roomId);
        if (!names) {
            names = new Set<string>();
            usedNamesByRoom.set(roomId, names);
        }
        return names;
    };

    for (const object of result.objects) {
        const roomId = result.cells[object.position.row]?.[object.position.col]?.roomId;
        if (roomId) getRoomNames(roomId).add(normalizeObjectName(object.name));
    }

    let objectIdCounter = 1;
    const createUniqueObjectId = (): string => {
        let candidate = `object-${objectIdCounter++}`;
        while (usedObjectIds.has(candidate)) {
            candidate = `object-${objectIdCounter++}`;
        }
        usedObjectIds.add(candidate);
        return candidate;
    };

    const placeObject = (template: ObjectTemplate, position: Position): boolean => {
        const key = `${position.row}-${position.col}`;
        const cell = result.cells[position.row]?.[position.col];
        if (!cell || usedObjectCells.has(key)) return false;

        const roomNames = getRoomNames(cell.roomId);
        const normalizedName = normalizeObjectName(template.name);
        if (roomNames.has(normalizedName)) return false;

        const object: SceneObject = {
            ...template,
            id: createUniqueObjectId(),
            position: { ...position }
        };

        result.objects.push(object);
        cell.objectIds.push(object.id);
        usedObjectCells.add(key);
        roomNames.add(normalizedName);
        return true;
    };

    // 1. Objets occupables : plusieurs « Chaise » ou « Tapis » peuvent
    // exister dans l'affaire, à condition d'être dans des pièces différentes.
    const shuffledPeople = shuffle(people, random);
    shuffledPeople.forEach((person, index) => {
        const shouldPlace = index === 0 || random() < occupiableChance;
        if (!shouldPlace) return;

        const position = solution.positions[person.id];
        const roomId = result.cells[position.row]?.[position.col]?.roomId;
        if (!roomId) return;

        const namesInRoom = getRoomNames(roomId);
        const availableTemplates = shuffle(
            OCCUPIABLE_OBJECTS.filter(template =>
                !namesInRoom.has(normalizeObjectName(template.name))
            ),
            random
        );
        if (availableTemplates.length === 0) return;

        placeObject(availableTemplates[0], position);
    });

    // 2. Objets bloquants : les noms peuvent se répéter d'une pièce à l'autre.
    for (const room of result.rooms) {
        const availableCells: Position[] = [];
        for (let row = 0; row < result.size; row++) {
            for (let col = 0; col < result.size; col++) {
                const cell = result.cells[row][col];
                const key = `${row}-${col}`;
                if (
                    cell.roomId === room.id &&
                    !cell.blocked &&
                    !occupiedKeys.has(key) &&
                    !usedObjectCells.has(key)
                ) {
                    availableCells.push({ row, col });
                }
            }
        }

        const namesInRoom = getRoomNames(room.id);
        const shuffledCells = shuffle(availableCells, random);

        // Favorise volontairement les objets déjà vus dans une autre pièce :
        // cela crée des leurres (plusieurs Tables, plusieurs Statues, etc.).
        // Le même nom reste unique à l'intérieur d'une pièce pour que
        // « la Table dans le Salon » reste une référence compréhensible.
        const namesUsedElsewhere = new Set<string>();
        for (const [otherRoomId, names] of usedNamesByRoom.entries()) {
            if (otherRoomId === room.id) continue;
            for (const name of names) namesUsedElsewhere.add(name);
        }

        const repeatedTemplates = shuffle(
            BLOCKING_OBJECTS.filter(template => {
                const name = normalizeObjectName(template.name);
                return !namesInRoom.has(name) && namesUsedElsewhere.has(name);
            }),
            random
        );
        const newTemplates = shuffle(
            BLOCKING_OBJECTS.filter(template => {
                const name = normalizeObjectName(template.name);
                return !namesInRoom.has(name) && !namesUsedElsewhere.has(name);
            }),
            random
        );
        const availableTemplates = [...repeatedTemplates, ...newTemplates];

        const count = maxBlockingObjectsPerRoom === 0
            ? 0
            : Math.min(
                shuffledCells.length,
                availableTemplates.length,
                randomInt(random, 1, maxBlockingObjectsPerRoom)
            );

        for (let index = 0; index < count; index++) {
            placeObject(availableTemplates[index], shuffledCells[index]);
        }
    }

    // Garde-fou : chaque instance doit avoir un identifiant différent.
    const finalIds = result.objects.map(object => object.id);
    if (new Set(finalIds).size !== finalIds.length) {
        throw new Error("Identifiants d'objets dupliqués : génération interrompue.");
    }

    return result;
}
