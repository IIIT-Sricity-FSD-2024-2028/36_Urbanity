import api from "../../../api/client.js";
const options = { authenticated: false, withCredentials: true };
const base = "/community-registrations";
export const registrationService = {
  pricing: async (signal) =>
    (await api.get(`${base}/pricing`, { ...options, signal })).data,
  quote: async (body) => (await api.post(`${base}/quote`, body, options)).data,
  submit: async (body) => (await api.post(base, body, options)).data,
  status: async (id, signal) =>
    (
      await api.get(`${base}/${encodeURIComponent(id)}/status`, {
        ...options,
        signal,
      })
    ).data,
  mockPayment: async (id, body) =>
    (
      await api.post(
        `${base}/${encodeURIComponent(id)}/mock-payments`,
        body,
        options,
      )
    ).data,
  evidence: async (id, body) =>
    (
      await api.post(
        `${base}/${encodeURIComponent(id)}/payments`,
        body,
        options,
      )
    ).data,
  beginSetup: async (id) =>
    (
      await api.post(
        `${base}/${encodeURIComponent(id)}/setup-session`,
        {},
        options,
      )
    ).data,
  setup: async (id, password) =>
    (
      await api.post(
        `${base}/${encodeURIComponent(id)}/credential-setup`,
        { password },
        options,
      )
    ).data,
};
