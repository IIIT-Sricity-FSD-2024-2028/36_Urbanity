import { getSessionRevision } from "../../../api/client.js";
import { cacheTags, runServiceQuery, urbanityApi } from "../../../api/urbanityApi.js";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { superAdminService } from "./superAdminService.js";

const communityTag = (id) => ({ type: cacheTags.superAdminCommunity, id });
const communityListTag = communityTag("LIST");

export const superAdminCommunitiesApi = urbanityApi.injectEndpoints({
  endpoints: (build) => ({
    listSuperAdminCommunities: build.query({
      queryFn: (sessionRevision, { signal }) =>
        runServiceQuery(signal, superAdminService.listCommunities, sessionRevision),
      providesTags: (communities) => [
        communityListTag,
        ...(communities ?? []).map(({ id }) => communityTag(id)),
      ],
    }),
    updateSuperAdminCommunity: build.mutation({
      queryFn: ({ id, changes }, { signal }) =>
        runServiceQuery(signal, () => superAdminService.updateCommunity(id, changes, signal)),
      invalidatesTags: (_result, error, { id }) => error ? [] : [communityTag(id)],
    }),
    deleteSuperAdminCommunity: build.mutation({
      queryFn: (id, { signal }) =>
        runServiceQuery(signal, async () => (await superAdminService.deleteCommunity(id, signal)) ?? null),
      invalidatesTags: (_result, error, id) => error ? [] : [communityListTag, communityTag(id)],
    }),
  }),
});

export const {
  useUpdateSuperAdminCommunityMutation,
  useDeleteSuperAdminCommunityMutation,
} = superAdminCommunitiesApi;

export function useSuperAdminCommunityDirectory() {
  const { authenticated, loading, sessionRevision, user } = useAuth();
  return superAdminCommunitiesApi.useListSuperAdminCommunitiesQuery(sessionRevision, {
    skip: !authenticated || loading || user?.role !== ROLES.SUPER_ADMIN,
    refetchOnMountOrArgChange: true,
  });
}

export async function createSuperAdminCommunity(payload, dispatch) {
  const revision = getSessionRevision();
  await superAdminService.createCommunity(payload);
  if (revision === getSessionRevision()) {
    dispatch(urbanityApi.util.invalidateTags([communityListTag]));
  }
}
