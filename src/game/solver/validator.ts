import type { Board, Person, Position, PuzzleSolution } from "../model/types";

export type ValidationResult = {
    valid: boolean;
    errors: string[];
    murdererId: string | null;
};

function isInsideBoard(position: Position, board: Board): boolean {
    return (
        Number.isInteger(position.row) &&
        Number.isInteger(position.col) &&
        position.row >= 0 && position.row < board.size &&
        position.col >= 0 && position.col < board.size
    );
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

export function validateSolution(
    board: Board,
    people: Person[],
    solution: PuzzleSolution
): ValidationResult {
    const errors: string[] = [];

    if (
        !Number.isInteger(board.size) ||
        board.size < 2 ||
        board.cells.length !== board.size ||
        board.cells.some(row => row.length !== board.size)
    ) {
        return {
            valid: false,
            errors: ["Le plateau possède des dimensions invalides."],
            murdererId: null
        };
    }

    if (people.length !== board.size) {
        errors.push(`Nombre de personnages incorrect : ${people.length} au lieu de ${board.size}.`);
    }

    const ids = new Set(people.map(person => person.id));
    if (ids.size !== people.length) errors.push("Certains personnages possèdent le même identifiant.");

    const victims = people.filter(person => person.role === "victim");
    const suspects = people.filter(person => person.role === "suspect");

    if (victims.length !== 1) errors.push(`Il faut exactement une victime. Trouvé : ${victims.length}.`);
    if (suspects.length !== board.size - 1) {
        errors.push(`Il faut exactement ${board.size - 1} suspects. Trouvé : ${suspects.length}.`);
    }

    const usedPositions = new Set<string>();
    const usedRows = new Set<number>();
    const usedColumns = new Set<number>();
    let allPositionsValid = true;

    for (const person of people) {
        const position = solution.positions[person.id];
        if (!position) {
            errors.push(`Position manquante pour ${person.name}.`);
            allPositionsValid = false;
            continue;
        }

        if (!isInsideBoard(position, board)) {
            errors.push(`Position hors plateau pour ${person.name}.`);
            allPositionsValid = false;
            continue;
        }

        const key = `${position.row}-${position.col}`;
        if (usedPositions.has(key)) errors.push(`${person.name} partage une case avec un autre personnage.`);
        usedPositions.add(key);

        if (usedRows.has(position.row)) errors.push(`Plusieurs personnages occupent la ligne ${position.row + 1}.`);
        if (usedColumns.has(position.col)) errors.push(`Plusieurs personnages occupent la colonne ${position.col + 1}.`);
        usedRows.add(position.row);
        usedColumns.add(position.col);

        if (!isCellOccupable(board, position)) {
            errors.push(`La case de ${person.name} ne peut pas accueillir de personnage.`);
            allPositionsValid = false;
        }
    }

    if (usedRows.size !== board.size || usedColumns.size !== board.size) {
        errors.push("Toutes les lignes et colonnes doivent contenir exactement un personnage.");
    }

    let expectedMurdererId: string | null = null;

    if (allPositionsValid && victims.length === 1 && suspects.length === board.size - 1) {
        const victim = victims[0];
        const victimPosition = solution.positions[victim.id];
        const victimCell = board.cells[victimPosition.row][victimPosition.col];

        const suspectsInVictimRoom = suspects.filter(suspect => {
            const position = solution.positions[suspect.id];
            if (!position || !isInsideBoard(position, board)) return false;
            return board.cells[position.row][position.col].roomId === victimCell.roomId;
        });

        if (suspectsInVictimRoom.length !== 1) {
            errors.push(`La pièce de la victime doit contenir exactement un suspect. Trouvé : ${suspectsInVictimRoom.length}.`);
        } else {
            expectedMurdererId = suspectsInVictimRoom[0].id;
            if (solution.murdererId !== expectedMurdererId) {
                errors.push("L'identifiant du coupable ne correspond pas à sa position.");
            }
        }
    }

    const declaredMurderer = people.find(person => person.id === solution.murdererId);
    if (!declaredMurderer || declaredMurderer.role !== "suspect") {
        errors.push("Le coupable désigné n'existe pas ou n'est pas un suspect.");
    }

    return {
        valid: errors.length === 0,
        errors,
        murdererId: expectedMurdererId
    };
}
