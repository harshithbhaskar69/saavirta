import { marketRoute } from "@/features/markets/server";
export const POST = (request: Request) => marketRoute(request, "context");
