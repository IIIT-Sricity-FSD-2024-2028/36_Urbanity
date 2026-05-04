export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  cors: {
    origin: true,
    allowedHeaders: ['Content-Type', 'role'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  },
};
