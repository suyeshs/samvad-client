// bolbachan1/worker-entry.ts
// Temporarily commented out for production testing
// export { default } from "./.open-next/worker";

// Placeholder export for production testing
export default function worker() {
  return new Response("Worker placeholder", { status: 200 });
}
