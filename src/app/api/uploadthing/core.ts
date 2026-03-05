import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";

const f = createUploadthing();
export const utapi = new UTApi();

export const ourFileRouter = {
  avatarUploader: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(async () => ({ }))
    .onUploadComplete(() => {}), // left empty on purpose

  voiceUploader: f({ audio: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => ({ }))
    .onUploadComplete(() => {}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;