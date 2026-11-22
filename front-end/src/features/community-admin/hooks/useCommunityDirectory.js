import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { communityDirectoryApi } from "../services/communityDirectoryApi.js";

export function useCommunityDirectory(resources) {
  const { authenticated, loading, sessionRevision, user } = useAuth();
  const allowed = authenticated && !loading && user?.role === ROLES.COMMUNITY_ADMIN;
  const options = (resource) => ({
    skip: !allowed || !resources.includes(resource),
    refetchOnMountOrArgChange: true,
  });
  const communities = communityDirectoryApi.useListCommunityAdminCommunitiesQuery(sessionRevision, options("communities"));
  const towers = communityDirectoryApi.useListCommunityAdminTowersQuery(sessionRevision, options("towers"));
  const floors = communityDirectoryApi.useListCommunityAdminFloorsQuery(sessionRevision, options("floors"));
  const apartments = communityDirectoryApi.useListCommunityAdminApartmentsQuery(sessionRevision, options("apartments"));
  const users = communityDirectoryApi.useListCommunityAdminUsersQuery(sessionRevision, options("users"));
  const workers = communityDirectoryApi.useListCommunityAdminWorkersQuery(sessionRevision, options("workers"));
  const queries = { communities, towers, floors, apartments, users, workers };
  const active = resources.map((resource) => queries[resource]);
  const ready = allowed && active.every((query) => query.currentData !== undefined);
  const data = ready ? Object.fromEntries(resources.map((resource) => [resource, queries[resource].currentData])) : null;
  return {
    data,
    loading: active.some((query) => query.isLoading || query.isFetching && query.currentData === undefined),
    error: active.find((query) => query.error)?.error,
    reload: () => Promise.all(active.filter((query) => !query.isUninitialized && query.isError).map((query) => query.refetch())),
  };
}
