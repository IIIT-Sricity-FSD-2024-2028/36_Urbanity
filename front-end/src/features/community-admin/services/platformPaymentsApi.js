import { api } from "../../../api/client.js";
import { runServiceQuery, urbanityApi } from "../../../api/urbanityApi.js";

const tag = "CommunityPlatformPayment";
const summaryTag = { type: tag, id: "SUMMARY" };
const historyTag = { type: tag, id: "HISTORY" };

export const platformPaymentsApi = urbanityApi.enhanceEndpoints({ addTagTypes: [tag] }).injectEndpoints({
  endpoints: (build) => ({
    getPlatformPaymentSummary: build.query({
      queryFn: (revision, { signal }) => runServiceQuery(signal, async (activeSignal) =>
        (await api.get("/platform-payments/summary", { signal: activeSignal })).data, revision),
      providesTags: [summaryTag],
    }),
    getPlatformPaymentHistory: build.query({
      queryFn: (revision, { signal }) => runServiceQuery(signal, async (activeSignal) =>
        (await api.get("/platform-payments/history", { signal: activeSignal })).data, revision),
      providesTags: [historyTag],
    }),
    getPlatformPaymentReceipt: build.query({
      queryFn: ({ sessionRevision, id }, { signal }) => runServiceQuery(signal, async (activeSignal) =>
        (await api.get(`/platform-payments/history/${encodeURIComponent(id)}`, { signal: activeSignal })).data, sessionRevision),
    }),
    payPlatformBalance: build.mutation({
      queryFn: ({ sessionRevision, registrationLinked }, { signal }) => runServiceQuery(signal, async (activeSignal) =>
        (await api.post(registrationLinked ? "/platform-payments/mock-balance" : "/subscriptions/me/mock-payment",
          registrationLinked ? { confirmed: true } : {}, { signal: activeSignal })).data, sessionRevision),
      invalidatesTags: (_data, error) => error ? [] : [summaryTag, historyTag],
    }),
  }),
});

export const {
  useGetPlatformPaymentSummaryQuery, useGetPlatformPaymentHistoryQuery,
  useGetPlatformPaymentReceiptQuery, usePayPlatformBalanceMutation,
} = platformPaymentsApi;
