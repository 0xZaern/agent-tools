// internal types shared between parsers and scorer

export interface RawFileCov {
  path: string;
  linesFound: number;
  linesHit: number;
  branchesFound: number;
  branchesHit: number;
  functionsFound: number;
  functionsHit: number;
  /** line numbers with zero hits */
  uncoveredLineNumbers: number[];
}
