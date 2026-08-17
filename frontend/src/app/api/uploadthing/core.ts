import { cookies } from "next/headers";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const upload = createUploadthing();

export const fileRouter = {
  studyMaterial: upload({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = (await cookies()).get("access_token");
      if (!session) throw new UploadThingError("Sign in before uploading");
      return { authenticated: true };
    })
    .onUploadComplete(async ({ file }) => ({
      key: file.key,
      url: file.ufsUrl,
      name: file.name,
      type: file.type,
    })),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
