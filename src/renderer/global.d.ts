import type { BugzilliApi } from "../shared/types";

declare module "*.css";

declare global {
  interface Window {
    bugzilli: BugzilliApi;
  }
}

export {};
