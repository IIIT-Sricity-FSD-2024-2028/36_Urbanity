import { getSessionRevision } from "../../../api/client.js";
import { runServiceQuery, urbanityApi } from "../../../api/urbanityApi.js";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { residentService as service } from "./residentService.js";

export const residentComplaintTags = Object.freeze({
  complaint: "ResidentComplaint",
  review: "ResidentComplaintReview",
  attachment: "ResidentComplaintAttachment",
  hierarchy: "ResidentHierarchy",
});

const complaintTag = (id = "LIST") => ({ type: residentComplaintTags.complaint, id });
const reviewTag = (id) => ({ type: residentComplaintTags.review, id });
const attachmentTag = (id) => ({ type: residentComplaintTags.attachment, id });
const hierarchyTag = () => ({ type: residentComplaintTags.hierarchy, id: "ME" });

export const residentComplaintsApi = urbanityApi
  .enhanceEndpoints({ addTagTypes: Object.values(residentComplaintTags) })
  .injectEndpoints({
    endpoints: (build) => ({
      listResidentComplaints: build.query({
        queryFn: (sessionRevision, { signal }) =>
          runServiceQuery(signal, (activeSignal) => service.listComplaints(activeSignal), sessionRevision),
        providesTags: (items) => [
          complaintTag(),
          ...(items ?? []).map(({ id }) => complaintTag(id)),
        ],
      }),
      getResidentComplaint: build.query({
        queryFn: ({ id, sessionRevision }, { signal }) =>
          runServiceQuery(signal, (activeSignal) => service.getComplaint(id, activeSignal), sessionRevision),
        providesTags: (_item, _error, { id }) => [complaintTag(id)],
      }),
      getResidentComplaintReview: build.query({
        queryFn: ({ id, sessionRevision }, { signal }) =>
          runServiceQuery(signal, (activeSignal) => service.getReview(id, activeSignal), sessionRevision),
        providesTags: (_review, _error, { id }) => [reviewTag(id)],
      }),
      getResidentComplaintAttachments: build.query({
        queryFn: ({ id, sessionRevision }, { signal }) =>
          runServiceQuery(signal, (activeSignal) => service.listAttachments(id, activeSignal), sessionRevision),
        providesTags: (_items, _error, { id }) => [attachmentTag(id)],
      }),
      getResidentHierarchy: build.query({
        queryFn: (sessionRevision, { signal }) =>
          runServiceQuery(signal, (activeSignal) => service.getHierarchy(activeSignal), sessionRevision),
        providesTags: [hierarchyTag()],
      }),
      createResidentComplaint: build.mutation({
        queryFn: ({ payload, sessionRevision }, { signal }) =>
          runServiceQuery(signal, (activeSignal) => service.createComplaint(payload, activeSignal), sessionRevision),
        invalidatesTags: (_result, error) => error ? [] : [complaintTag()],
      }),
      submitResidentComplaintReview: build.mutation({
        queryFn: ({ id, payload, sessionRevision }, { signal }) =>
          runServiceQuery(signal, (activeSignal) => service.submitReview(id, payload, activeSignal), sessionRevision),
        invalidatesTags: (_result, error, { id }) => error ? [] : [
          reviewTag(id), complaintTag(id), complaintTag(),
        ],
      }),
    }),
  });

export const {
  useListResidentComplaintsQuery,
  useGetResidentComplaintQuery,
  useGetResidentComplaintReviewQuery,
  useGetResidentComplaintAttachmentsQuery,
  useGetResidentHierarchyQuery,
  useCreateResidentComplaintMutation,
  useSubmitResidentComplaintReviewMutation,
} = residentComplaintsApi;

function useResidentSession() {
  const { authenticated, loading, sessionRevision, user } = useAuth();
  return {
    sessionRevision,
    skip: !authenticated || loading || user?.role !== ROLES.RESIDENT,
  };
}

function asResource(result, skip) {
  const data = result.isError ? null : (result.currentData ?? null);
  return {
    data,
    error: result.isError ? result.error : null,
    loading: result.isFetching,
    initialLoading: !skip && !data && !result.isError,
    reload: () => skip ? Promise.resolve(null) : result.refetch(),
  };
}

export function useResidentComplaints() {
  const { sessionRevision, skip } = useResidentSession();
  const result = useListResidentComplaintsQuery(sessionRevision, {
    skip,
    refetchOnMountOrArgChange: true,
  });
  return asResource(result, skip);
}

export function useResidentHierarchy() {
  const { sessionRevision, skip } = useResidentSession();
  const result = useGetResidentHierarchyQuery(sessionRevision, {
    skip,
    refetchOnMountOrArgChange: true,
  });
  return asResource(result, skip);
}

export function useResidentComplaint(id) {
  const { sessionRevision, skip: roleSkip } = useResidentSession();
  const skip = roleSkip || !id;
  const result = useGetResidentComplaintQuery({ id, sessionRevision }, {
    skip,
    refetchOnMountOrArgChange: true,
  });
  return asResource(result, skip);
}

export function useResidentComplaintReview(id) {
  const { sessionRevision, skip: roleSkip } = useResidentSession();
  const skip = roleSkip || !id;
  const result = useGetResidentComplaintReviewQuery({ id, sessionRevision }, {
    skip,
    refetchOnMountOrArgChange: true,
  });
  return asResource(result, skip);
}

export function useResidentComplaintAttachments(id) {
  const { sessionRevision, skip: roleSkip } = useResidentSession();
  const skip = roleSkip || !id;
  const result = useGetResidentComplaintAttachmentsQuery({ id, sessionRevision }, {
    skip,
    refetchOnMountOrArgChange: true,
  });
  return asResource(result, skip);
}

// Files and blobs stay outside Redux. Invalidate metadata only after a successful
// upload, and only if the same resident session is still active.
export async function uploadResidentComplaintAttachments(dispatch, id, files, revision = getSessionRevision()) {
  if (revision !== getSessionRevision()) {
    return files.map(() => ({
      status: "rejected",
      reason: new Error("Your session changed. Sign in again before retrying these uploads."),
    }));
  }
  const results = await Promise.allSettled(
    files.map((file) => service.uploadAttachment(id, file)),
  );
  const succeeded = results.some((result) => result.status === "fulfilled");
  if (succeeded && revision === getSessionRevision()) {
    dispatch(urbanityApi.util.invalidateTags([attachmentTag(id)]));
  }
  return results;
}

export function invalidateResidentHierarchy(dispatch, revision = getSessionRevision()) {
  if (revision === getSessionRevision()) {
    dispatch(urbanityApi.util.invalidateTags([hierarchyTag()]));
  }
}
