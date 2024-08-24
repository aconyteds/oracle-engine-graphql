export type Context = {};

export const getContext = async () => {
  const context: Context = {};
  return {
    ...context,
    getModuleContext: async () => {
      return context;
    },
  };
};
