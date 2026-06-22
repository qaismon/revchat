export type CallState = "idle" | "calling" | "incoming" | "connected" | "ended";

export interface CallUser {
  userId: string;
  userName: string;
}
