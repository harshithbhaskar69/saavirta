import { marketRoute } from "@/features/markets/server";
export const GET = (request: Request) => marketRoute(request, "dashboard");
export const POST = (request: Request) => marketRoute(request, "dashboard");
