
export type Difficulty = "easy" | "normal" | "hard" | "expert";

export type Position = {
    row: number;
    col: number;
};

export type Room = {
    id: string;
    name: string;
    color: string;
};

export type SceneObject = {
    id: string;
    name: string;
    type: "seat" | "furniture" | "decoration";
    occupiable: boolean;
    position: Position;
};

export type Cell = {
    position: Position;
    roomId: string;
    objectIds: string[];
    blocked: boolean;
};

export type Person = {
    id: string;
    name: string;
    role: "suspect" | "victim";
};

export type Direction = "north" | "south" | "east" | "west";

export type ClueRule =
    | { type: "in-room"; roomId: string }
    | { type: "not-in-room"; roomId: string }
    | { type: "on-object"; objectId: string }
    | { type: "beside-object"; objectId: string }
    | { type: "same-room-as"; personId: string }
    | { type: "different-room-from"; personId: string }
    | { type: "beside-person"; personId: string }
    | { type: "relative-to-person"; personId: string; direction: Direction }
    | { type: "on-row"; row: number }
    | { type: "on-column"; col: number };

export type Clue = {
    id: string;
    personId: string;
    description: string;
    rule: ClueRule;
};

export type Board = {
    size: number;
    cells: Cell[][];
    rooms: Room[];
    objects: SceneObject[];
};

export type Puzzle = {
    id: string;
    title: string;
    difficulty: Difficulty;
    board: Board;
    people: Person[];
    clues: Clue[];
};

export type PuzzleSolution = {
    positions: Record<string, Position>;
    murdererId: string;
};
