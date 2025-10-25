import B2 from "backblaze-b2";

const b2 = new B2({
  applicationKeyId: process.env.B2_APPLICATION_KEY_ID || "",
  applicationKey: process.env.B2_APPLICATION_KEY || "",
});

let isAuthorized = false;

export const authorizeB2 = async (): Promise<void> => {
  if (isAuthorized) return;

  try {
    await b2.authorize();
    isAuthorized = true;
    console.log("Backblaze B2 authorized successfully");
  } catch (error) {
    console.error("Failed to authorize Backblaze B2:", error);
    throw new Error("Backblaze B2 authorization failed");
  }
};

export const getB2 = (): B2 => {
  if (!isAuthorized) {
    throw new Error("Backblaze B2 not authorized. Call authorizeB2() first.");
  }
  return b2;
};

export default b2;
