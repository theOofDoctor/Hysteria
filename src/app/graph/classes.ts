export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const NULL_VERTEX_ID = -1;

export class Commit {
  subject: string | null = null;
  body: string | null = null;
  author: Author | null = null;
  date: string | null = null;
  sha: string | null = null;
  parents: string[] = [];
  constructor(init?: Partial<Commit>) {
    Object.assign(this, init);
  }
}

export class Author {
  name: string | null = null;
  email: string | null = null;
  constructor(init?: Partial<Author>) {
    Object.assign(this, init);
  }
}

export class GraphConfig {
  x: number = 16;
  y: number = 24;
  offsetX: number = 16;
  offsetY: number = 12;
  colours: Array<string> = [
    '#eb6d5d',
    '#ef9536',
    '#f4d951',
    '#68d699',
    '#74ccfc',
    '#8f5ef9',
    '#ed84f3',
  ];
}

export class Point {
  readonly x: number;
  readonly y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public toPixel(config: GraphConfig): Pixel {
    return new Pixel(config.x * this.x + config.offsetX, config.y * this.y + config.offsetY);
  }
}

export class Line {
  readonly p1: Point;
  readonly p2: Point;
  constructor(p1: Point, p2: Point) {
    this.p1 = p1;
    this.p2 = p2;
  }
}

export class Pixel {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class PlacedLine {
  readonly p1: Pixel;
  readonly p2: Pixel;

  constructor(p1: Pixel, p2: Pixel) {
    this.p1 = p1;
    this.p2 = p2;
  }
}

export class Branch {
  private readonly colour: number;
  private lines: Line[] = [];

  constructor(colour: number) {
    this.colour = colour;
  }

  public addLine(p1: Point, p2: Point): void {
    this.lines.push(new Line(p1, p2));
  }

  public getLines(): Line[] {
    return this.lines;
  }

  public getColour(): number {
    return this.colour;
  }
};

interface UnavailablePoint {
  readonly connectsTo: Vertex | null;
  readonly onBranch: Branch;
}

export class Vertex {
  public readonly id: number;

  private x: number = 0;
  private children: Vertex[] = [];
  private parents: Vertex[] = [];
  private nextParent: number = 0;
  private onBranch: Branch | null = null;
  private nextX: number = 0;
  private connections: UnavailablePoint[] = [];

  constructor(id: number) {
    this.id = id;
  }

  public getX(): number {
    return this.x;
  }

  public addChild(child: Vertex): void {
    this.children.push(child);
  }

  public addParent(parent: Vertex): void {
    this.parents.push(parent);
  }

  public getNextParent(): Vertex | null {
    return this.nextParent < this.parents.length ? this.parents[this.nextParent] : null;
  }

  public registerParentProcessed(): void {
    this.nextParent++;
  }

  public addToBranch(branch: Branch, x: number): void {
    if (this.onBranch === null) {
      this.onBranch = branch;
      this.x = x;
    }
  }

  public registerUnavailablePoint(x: number, connectsToVertex: Vertex | null, onBranch: Branch) {
    if (x === this.nextX) {
      this.nextX = x + 1;
      this.connections[x] = { connectsTo: connectsToVertex, onBranch: onBranch };
    }
  }

  public getPointConnectingTo(vertex: Vertex | null, onBranch: Branch): Point | null {
    for (let i = 0; i < this.connections.length; i++) {
      if (this.connections[i].connectsTo === vertex && this.connections[i].onBranch === onBranch) {
        return new Point(i, this.id);
      }
    }
    return null;
  }

  public isOnBranch(): boolean {
    return this.onBranch !== null;
  }

  public isMerge(): boolean {
    return this.parents.length > 1;
  }

  public getBranch() {
    return this.onBranch;
  }

  public getPoint(): Point {
    return new Point(this.x, this.id);
  }

  public getNextPoint(): Point {
    return new Point(this.nextX, this.id);
  }

  public getColour() {
    return this.onBranch?.getColour();
  }
}

export class VertexData {
  public readonly id: number;
  public readonly cx: number;
  public readonly cy: number;
  public readonly r: number;
  public readonly colour: string;

  constructor(id: number, cx: number, cy: number, r: number, colour: string) {
    this.id = id;
    this.cx = cx;
    this.cy = cy;
    this.r = r;
    this.colour = colour;
  }
}