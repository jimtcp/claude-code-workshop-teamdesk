import { suggestInput } from "@repo/services/assistant";
import { publicProcedure, router } from "../init.ts";

export const assistantRouter = router({
  suggest: publicProcedure
    .input(suggestInput)
    .query(({ ctx, input }) => ctx.services.assistant.suggest(input)),
});
