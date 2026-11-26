import { runServiceQuery, urbanityApi } from "../../../api/urbanityApi.js";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { estimateService } from "./estimateService.js";

const tagType = "ComplaintEstimate";
export const complaintEstimateTag = (id) => ({ type: tagType, id });
const queueTag = (role) => complaintEstimateTag(`LIST-${role}`);

export const complaintEstimatesApi = urbanityApi
  .enhanceEndpoints({ addTagTypes: [tagType] })
  .injectEndpoints({
    endpoints: (build) => ({
      getComplaintEstimate: build.query({
        queryFn: ({ id, sessionRevision }, { signal }) =>
          runServiceQuery(signal, (activeSignal) => estimateService.get(id, activeSignal), sessionRevision),
        providesTags: (_data, _error, { id }) => [complaintEstimateTag(id)],
      }),
      listComplaintEstimates: build.query({
        queryFn: ({ sessionRevision }, { signal }) => runServiceQuery(signal, estimateService.list, sessionRevision),
        providesTags: (_data, _error, { role }) => [queueTag(role)],
      }),
      changeComplaintEstimate: build.mutation({
        queryFn: ({ operation, id, estimateId, payload, sessionRevision }, { signal }) =>
          runServiceQuery(signal, (activeSignal) => {
            if (operation === "submit") return estimateService.submit(id, payload, activeSignal);
            if (operation === "pay") return estimateService.pay(id, estimateId, activeSignal);
            return estimateService[operation](id, estimateId, payload, activeSignal);
          }, sessionRevision),
        invalidatesTags: (_data, error, { id }) => error && error.status !== 409
          ? [] : [complaintEstimateTag(id), queueTag(ROLES.TOWER_REPRESENTATIVE), queueTag(ROLES.COMMUNITY_ADMIN)],
      }),
    }),
  });

const { useGetComplaintEstimateQuery, useListComplaintEstimatesQuery } = complaintEstimatesApi;
export const { useChangeComplaintEstimateMutation } = complaintEstimatesApi;

function useEstimateSession(role, enabled) {
  const { authenticated, loading, sessionRevision, user } = useAuth();
  return {
    sessionRevision,
    options: {
      skip: !enabled || !authenticated || loading || user?.role !== role,
      refetchOnMountOrArgChange: true,
      pollingInterval: 30_000,
    },
  };
}

export function useComplaintEstimate(id, role) {
  const { sessionRevision, options } = useEstimateSession(role, Boolean(id));
  return useGetComplaintEstimateQuery({ id, role, sessionRevision }, options);
}

export function useComplaintEstimateQueue(role) {
  const { sessionRevision, options } = useEstimateSession(role, true);
  return useListComplaintEstimatesQuery({ role, sessionRevision }, options);
}
