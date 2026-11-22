import { getSessionRevision } from "../../../api/client.js";
import { runServiceQuery, urbanityApi } from "../../../api/urbanityApi.js";
import { ROLES } from "../../../constants/roles.js";
import { communityAdminService as service } from "./communityAdminService.js";

const tagTypes = {
  communities: "CommunityAdminCommunity",
  towers: "CommunityAdminTower",
  floors: "CommunityAdminFloor",
  apartments: "CommunityAdminApartment",
  users: "CommunityAdminUser",
  workers: "CommunityAdminWorker",
  history: "CommunityAdminOwnershipHistory",
};
const tag = (resource, id = "LIST") => ({ type: tagTypes[resource], id });
const lists = (...resources) => resources.map((resource) => tag(resource));

export const communityDirectoryApi = urbanityApi
  .enhanceEndpoints({ addTagTypes: Object.values(tagTypes) })
  .injectEndpoints({
    endpoints: (build) => {
      const directory = (resource, method) => build.query({
        queryFn: (revision, { signal }) => runServiceQuery(signal, () => service[method](signal), revision),
        providesTags: (items) => [tag(resource), ...(items ?? []).map(({ id }) => tag(resource, id))],
      });
      const write = (method, resources, detailResource) => build.mutation({
        queryFn: (args, { signal }) => runServiceQuery(signal, async () => {
          // Association responses can include a raw user. Writes need no response data in Redux.
          if (typeof args === "string") await service[method](args, signal);
          else if (args.id) await service[method](args.id, args.changes, signal);
          else await service[method](args, signal);
          return null;
        }),
        invalidatesTags: (_result, error, args) => error ? [] : [
          ...lists(...resources),
          ...(detailResource ? [tag(detailResource, typeof args === "string" ? args : args.id)] : []),
        ],
      });
      return {
        listCommunityAdminCommunities: directory("communities", "listCommunities"),
        listCommunityAdminTowers: directory("towers", "listTowers"),
        listCommunityAdminFloors: directory("floors", "listFloors"),
        listCommunityAdminApartments: directory("apartments", "listApartments"),
        listCommunityAdminUsers: directory("users", "listUsers"),
        listCommunityAdminWorkers: directory("workers", "listWorkers"),
        getCommunityAdminOwnershipHistory: build.query({
          queryFn: ({ id, sessionRevision }, { signal }) => runServiceQuery(
            signal, () => service.getApartmentOwnershipHistory(id, signal), sessionRevision,
          ),
          providesTags: (_data, _error, { id }) => [tag("history", id)],
        }),
        createCommunityAdminTower: write("createTower", ["towers"]),
        updateCommunityAdminTower: write("updateTower", ["towers", "floors", "apartments"]),
        deleteCommunityAdminTower: write("deleteTower", ["towers", "floors", "apartments"]),
        createCommunityAdminFloor: write("createFloor", ["floors"]),
        updateCommunityAdminFloor: write("updateFloor", ["floors", "apartments"]),
        deleteCommunityAdminFloor: write("deleteFloor", ["floors", "apartments"]),
        createCommunityAdminApartment: write("createApartment", ["apartments"]),
        updateCommunityAdminApartment: write("updateApartment", ["apartments"]),
        deleteCommunityAdminApartment: write("deleteApartment", ["apartments"], "history"),
        transferCommunityAdminOwnership: write("transferApartmentOwnership", ["apartments"], "history"),
        updateCommunityAdminUser: write("updateUser", ["users"]),
        deleteCommunityAdminUser: write("deleteUser", ["users"]),
        associateCommunityAdminResident: build.mutation({
          queryFn: ({ id, apartmentId }, { signal }) => runServiceQuery(signal, async () => {
            await service.associateResident(id, apartmentId, signal);
            return null;
          }),
          invalidatesTags: (_data, error) => error ? [] : lists("users"),
        }),
        associateCommunityAdminRepresentative: build.mutation({
          queryFn: ({ id, towerId }, { signal }) => runServiceQuery(signal, async () => {
            await service.associateRepresentative(id, towerId, signal);
            return null;
          }),
          invalidatesTags: (_data, error) => error ? [] : lists("users"),
        }),
        createCommunityAdminWorker: write("createWorker", ["workers"]),
        updateCommunityAdminWorker: write("updateWorker", ["workers"]),
        deactivateCommunityAdminWorker: write("deactivateWorker", ["workers"]),
      };
    },
  });

export async function mutateCommunityDirectory(dispatch, endpoint, args) {
  const request = dispatch(communityDirectoryApi.endpoints[endpoint].initiate(args));
  try { return await request.unwrap(); }
  finally { request.reset(); }
}

function invalidate(dispatch, revision, tags) {
  if (revision === getSessionRevision()) dispatch(communityDirectoryApi.util.invalidateTags(tags));
}

// Passwords stay in the service call and local form state, never in a dispatched argument.
export async function createCommunityUser(payload, specialization, dispatch) {
  const revision = getSessionRevision();
  const created = await service.createUser(payload);
  const affected = lists("users");
  if (payload.role === ROLES.RESIDENT && payload.residentSituation === "OWNER_OCCUPANT") {
    affected.push(...lists("apartments"), tag("history", payload.apartmentId));
  }
  invalidate(dispatch, revision, affected);
  if (payload.role !== ROLES.MAINTENANCE_WORKER) return;
  // Never start another provisioning write under a different user's session.
  if (revision !== getSessionRevision()) throw new Error("The session changed. Refresh the user and workforce lists before continuing provisioning.");
  try {
    await service.createWorker({ userId: created.id, specialization });
    invalidate(dispatch, revision, lists("workers"));
  } catch (profileError) {
    try {
      if (revision !== getSessionRevision()) throw profileError;
      const workers = await service.listWorkers();
      if (revision !== getSessionRevision()) throw profileError;
      if (workers.some((worker) => worker.userId === created.id)) {
        invalidate(dispatch, revision, lists("workers"));
        return;
      }
      await service.deleteUser(created.id);
      invalidate(dispatch, revision, lists("users"));
    } catch {
      invalidate(dispatch, revision, lists("users", "workers"));
      throw new Error("The worker account was created, but its profile could not be confirmed. Refresh the user and workforce lists before trying again.");
    }
    throw new Error(`${profileError.message} The incomplete worker account was removed.`);
  }
}

export async function saveCommunityUser({ user, payload, apartmentId, towerId }, dispatch, { currentUserId, refreshUser }) {
  const revision = getSessionRevision();
  if (payload.password) {
    await service.updateUser(user.id, payload);
    invalidate(dispatch, revision, lists("users"));
  } else {
    await mutateCommunityDirectory(dispatch, "updateCommunityAdminUser", { id: user.id, changes: payload });
  }
  if (revision !== getSessionRevision()) return;
  if (user.id === currentUserId) await refreshUser();
  try {
    if (user.role === ROLES.RESIDENT && apartmentId !== user.apartmentId) {
      await mutateCommunityDirectory(dispatch, "associateCommunityAdminResident", { id: user.id, apartmentId });
    }
    if (user.role === ROLES.TOWER_REPRESENTATIVE && towerId !== user.towerId) {
      await mutateCommunityDirectory(dispatch, "associateCommunityAdminRepresentative", { id: user.id, towerId });
    }
  } catch (error) {
    throw new Error(`User details were saved, but the association could not be updated. ${error.message}`);
  }
}

export async function saveCommunityApartment(dispatch, id, changes, transfer) {
  const revision = getSessionRevision();
  await mutateCommunityDirectory(dispatch, "updateCommunityAdminApartment", { id, changes });
  if (!transfer || revision !== getSessionRevision()) return;
  try {
    await mutateCommunityDirectory(dispatch, "transferCommunityAdminOwnership", { id, changes: transfer });
  } catch (error) {
    throw new Error(`Apartment details were saved, but ownership transfer failed. ${error.message}`);
  }
}
