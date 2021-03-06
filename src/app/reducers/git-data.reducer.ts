import { BranchData } from './../classes';
import { Vertex, Commit, Branch, GraphConfig, NULL_VERTEX_ID } from '../graph/classes';
import { createReducer, on } from '@ngrx/store';
import * as GitDataActions from '../actions/git-data.actions';

export const gitDataFeatureKey = 'git data';

export class CommitState {
  commitMap: Map<string, number> = new Map<string, number>();
  vertices: Vertex[] = [];
  branches: Branch[] = [];
  commitData: Commit[] = [];
  config: GraphConfig = new GraphConfig();
  dataLoaded: boolean = false;
  svgHeight: number = 0;
  svgWidth: number = 0;
  availableColours: number[] = [];

  constructor(init?: Partial<CommitState>) {
    Object.assign(this, init);
  }
}

export interface GitDataState {
  commitDatas: CommitState,
  branchesMap: Map<string, BranchData[]>;
  currentRepo: string;
}

export const initialState: GitDataState = {
  commitDatas: new CommitState({
    commitMap: new Map<string, number>(),
    vertices: [],
    branches: [],
    commitData: [],
    config: new GraphConfig(),
    dataLoaded: false,
    svgHeight: 0,
    svgWidth: 0,
    availableColours: []
  }),
  branchesMap: new Map<string, BranchData[]>(),
  currentRepo: ''
};

export const gitDataReducer = createReducer(
  initialState,

  on(GitDataActions.loadCommits, state => state),
  on(GitDataActions.loadCommitsSuccess, loadCommitsSuccess),
  on(GitDataActions.loadCommitsFailure, (state, action) => {
    console.error('Load commits Failure!!!', action.error);
    return state;
  }),
  on(GitDataActions.commitViewerLoaded, (state, action) => {
    return {
      ...state,
      currentRepo: action.repoPath
    };
  }),
  on(GitDataActions.loadRepoBranches, (state, action) => {
    return {
      ...state,
      currentRepo: action.repoPath
    };
  }),
  on(GitDataActions.loadRepoBranchesSuccess, (state, action) => {
    let updatedMap = state.branchesMap;
    updatedMap.set(action.repoPath, action.data);
    return {
      ...state,
      branchesMap: updatedMap
    };
  }),
  on(GitDataActions.loadRepoBranchesFailure, (state, action) => {
    console.error('Load Repo Branches Failure!!!', action.error);
    return state;
  }),
);

function loadCommitsSuccess(state: GitDataState, action: { commits: Commit[]; }): GitDataState {
  let newState: CommitState = JSON.parse(JSON.stringify(state.commitDatas));
  let determinePath = determinePathFn.bind(newState);

  Branch.resetFurthestX();
  newState.availableColours = [];
  newState.commitData = action.commits;
  newState.commitMap = new Map<string, number>(action.commits.map((commit, index) => {
    if (commit.sha != null)
      return [commit.sha, index];
    return ['', index]; // not sure about this
  }));

  // construct vertices
  newState.vertices = action.commits.map((commit, id) => new Vertex(id));

  const nullVertex = new Vertex(NULL_VERTEX_ID);
  action.commits.forEach((commit, i) => {
    commit.parents.forEach((parent, j) => {
      if (newState.commitMap.has(parent)) {
        newState.vertices[i].addParent(newState.vertices[newState.commitMap.get(parent) as number]);
        newState.vertices[newState.commitMap.get(parent) as number].addChild(newState.vertices[i]);
      } else {
        newState.vertices[i].addParent(nullVertex);
      }
    });
  });

  let i = 0;
  while (i < newState.vertices.length) {
    if (newState.vertices[i].getNextParent() !== null || !newState.vertices[i].isOnBranch()) {
      determinePath(i);
    } else {
      i++;
    }
  }

  newState.svgHeight = newState.vertices.length * newState.config.y + newState.config.offsetY - newState.config.y / 2;
  newState.svgWidth = 2 * newState.config.offsetX + (Branch.getFurtherstX() * newState.config.x);
  newState.dataLoaded = true;

  return { ...state, commitDatas: newState };
}

function determinePathFn(this: CommitState, index: number): void {
  let i = index;
  let vertex = this.vertices[i];
  let parentVertex = this.vertices[i].getNextParent();
  let curVertex;
  let lastPoint = !vertex.isOnBranch() ? vertex.getNextPoint() : vertex.getPoint();
  let curPoint;

  let getAvailableColour = getAvailableColourFn.bind(this);

  if (parentVertex !== null && parentVertex.id !== NULL_VERTEX_ID && vertex.isMerge() && vertex.isOnBranch() && parentVertex.isOnBranch()) {
    // Branch is a merge between two vertices already on branches
    let foundPointToParent = false, parentBranch = parentVertex.getBranch()!;
    for (i = index + 1; i < this.vertices.length; i++) {
      curVertex = this.vertices[i];
      curPoint = curVertex.getPointConnectingTo(parentVertex, parentBranch); // Check if there is already a point connecting the ith vertex to the required parent
      if (curPoint !== null) {
        foundPointToParent = true; // Parent was found
      } else {
        curPoint = curVertex.getNextPoint(); // Parent couldn't be found, choose the next available point for the vertex
      }
      parentBranch.addLine(lastPoint, curPoint);
      curVertex.registerUnavailablePoint(curPoint.x, parentVertex, parentBranch);
      lastPoint = curPoint;

      if (foundPointToParent) {
        vertex.registerParentProcessed();
        break;
      }
    }
  } else {
    // Branch is normal
    let branch = new Branch(getAvailableColour(index));
    vertex.addToBranch(branch, lastPoint.x);
    vertex.registerUnavailablePoint(lastPoint.x, vertex, branch);
    for (i = index + 1; i < this.vertices.length; i++) {
      curVertex = this.vertices[i];
      curPoint = parentVertex === curVertex && parentVertex.isOnBranch() ? curVertex.getPoint() : curVertex.getNextPoint();
      branch.addLine(lastPoint, curPoint);
      curVertex.registerUnavailablePoint(curPoint.x, parentVertex, branch);
      lastPoint = curPoint;

      if (parentVertex === curVertex) {
        // The parent of <vertex> has been reached, progress <vertex> and <parentVertex> to continue building the branch
        vertex.registerParentProcessed();
        let parentVertexOnBranch = parentVertex.isOnBranch();
        parentVertex.addToBranch(branch, curPoint.x);
        vertex = parentVertex;
        parentVertex = vertex.getNextParent();
        if (parentVertex === null || parentVertexOnBranch) {
          // There are no more parent vertices, or the parent was already on a branch
          break;
        }
      }
    }
    if (i === this.vertices.length && parentVertex !== null && parentVertex.id === NULL_VERTEX_ID) {
      // Vertex is the last in the graph, so no more branch can be formed to the parent
      vertex.registerParentProcessed();
    }
    this.branches.push(branch);
    this.availableColours[branch.getColour()] = i;
  }
}

function getAvailableColourFn(this: CommitState, startAt: number) {
  for (let i = 0; i < this.availableColours.length; i++) {
    if (startAt > this.availableColours[i]) {
      return i;
    }
  }
  this.availableColours.push(0);
  return this.availableColours.length - 1;
}