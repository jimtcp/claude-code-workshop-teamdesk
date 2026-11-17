import { suggestInput } from "@repo/services/assistant";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../init.ts";

export const assistantRouter = router({
  suggest: publicProcedure.input(suggestInput).query(async ({ ctx, input }) => {
    const result = await ctx.services.assistant.suggest(input);
    if (!result.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
    }
    return { rooms: result.rooms, slot: result.slot };
  }),
});
