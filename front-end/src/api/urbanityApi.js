import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSessionRevision } from "./client.js";

export const cacheTags = {
  superAdminCommunity: "SuperAdminCommunity",
};

export const urbanityApi = createApi({
  reducerPath: "urbanityApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: Object.values(cacheTags),
  endpoints: () => ({}),
});

const inactiveRequest = { error: { status: 0, message: "The request is no longer active." } };

export async function runServiceQuery(signal, request, revision = getSessionRevision()) {
  if (revision !== getSessionRevision() || signal.aborted) return inactiveRequest;
  try {
    const data = await request(signal);
    if (revision !== getSessionRevision() || signal.aborted) {
      return inactiveRequest;
    }
    return { data };
  } catch (error) {
    return {
      error: {
        status: Number.isInteger(error?.status) ? error.status : 0,
        message: typeof error?.message === "string" && error.message
          ? error.message
          : "Unable to complete the request.",
      },
    };
  }
}
