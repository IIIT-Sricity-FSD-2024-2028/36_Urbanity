import { getSessionRevision } from "../../../api/client.js";
import { runServiceQuery, urbanityApi } from "../../../api/urbanityApi.js";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { complaintEstimateTag } from "../../complaint-estimates/services/complaintEstimatesApi.js";
import { maintenanceWorkerService as service } from "./maintenanceWorkerService.js";

export const workerTaskTags = Object.freeze({
  task: "MaintenanceWorkerTask",
  attachment: "MaintenanceWorkerAttachment",
  profile: "MaintenanceWorkerProfile",
});

const taskTag = (id = "LIST") => ({ type: workerTaskTags.task, id });
const attachmentTag = (id) => ({ type: workerTaskTags.attachment, id });
const profileTag = () => ({ type: workerTaskTags.profile, id: "ME" });

export const workerTasksApi = urbanityApi
  .enhanceEndpoints({ addTagTypes: Object.values(workerTaskTags) })
  .injectEndpoints({
    endpoints: (build) => ({
      listMaintenanceWorkerTasks: build.query({
        queryFn: (sessionRevision, { signal }) =>
          runServiceQuery(signal, service.getTasks, sessionRevision),
        providesTags: (tasks) => [taskTag(), ...(tasks ?? []).map(({ id }) => taskTag(id))],
      }),
      getMaintenanceWorkerTask: build.query({
        queryFn: ({ id, sessionRevision }, { signal }) =>
          runServiceQuery(signal, () => service.getTask(id, signal), sessionRevision),
        providesTags: (_task, _error, { id }) => [taskTag(id)],
      }),
      getMaintenanceWorkerTaskAttachments: build.query({
        queryFn: ({ id, sessionRevision }, { signal }) =>
          runServiceQuery(signal, () => service.getAttachments(id, signal), sessionRevision),
        providesTags: (_attachments, _error, { id }) => [attachmentTag(id)],
      }),
      getMaintenanceWorkerProfile: build.query({
        queryFn: (sessionRevision, { signal }) =>
          runServiceQuery(signal, service.getProfile, sessionRevision),
        providesTags: [profileTag()],
      }),
      startMaintenanceWorkerTask: build.mutation({
        queryFn: ({ id, sessionRevision }, { signal }) =>
          runServiceQuery(signal, () => service.startWork(id), sessionRevision),
        invalidatesTags: (_result, error, { id }) => error ? [] : [taskTag(), taskTag(id), complaintEstimateTag(id)],
      }),
      resolveMaintenanceWorkerTask: build.mutation({
        queryFn: ({ id, sessionRevision, problemFound, resolutionSummary, proofAttachmentIds }, { signal }) =>
          runServiceQuery(signal, () => service.resolveWork(id, {
            problemFound, resolutionSummary, proofAttachmentIds,
          }), sessionRevision),
        invalidatesTags: (_result, error, { id }) => error ? [] : [taskTag(), taskTag(id), complaintEstimateTag(id)],
      }),
    }),
  });

export const {
  useListMaintenanceWorkerTasksQuery,
  useGetMaintenanceWorkerTaskQuery,
  useGetMaintenanceWorkerTaskAttachmentsQuery,
  useGetMaintenanceWorkerProfileQuery,
  useStartMaintenanceWorkerTaskMutation,
  useResolveMaintenanceWorkerTaskMutation,
} = workerTasksApi;

export function useWorkerTaskList() {
  const { authenticated, loading, sessionRevision, user } = useAuth();
  return useListMaintenanceWorkerTasksQuery(sessionRevision, {
    skip: !authenticated || loading || user?.role !== ROLES.MAINTENANCE_WORKER,
    refetchOnMountOrArgChange: true,
  });
}

export function useWorkerProfile() {
  const { authenticated, loading, sessionRevision, user } = useAuth();
  return useGetMaintenanceWorkerProfileQuery(sessionRevision, {
    skip: !authenticated || loading || user?.role !== ROLES.MAINTENANCE_WORKER,
    refetchOnMountOrArgChange: true,
  });
}

export async function uploadWorkerProof(dispatch, id, file) {
  const sessionRevision = getSessionRevision();
  const result = await service.uploadProof(id, file);
  if (sessionRevision === getSessionRevision()) {
    dispatch(workerTasksApi.util.invalidateTags([attachmentTag(id)]));
  }
  return result;
}
