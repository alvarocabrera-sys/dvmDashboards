import { app } from '../api/index.js';

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`[dvmDashboards] API server listening on ${port}`);
});
