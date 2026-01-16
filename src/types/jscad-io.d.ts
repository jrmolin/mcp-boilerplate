declare module "@jscad/io" {
  export const stlSerializer: {
    serialize: (options: { binary?: boolean }, ...geometries: any[]) => any;
  };
  export const objSerializer: {
    serialize: (options: Record<string, unknown>, ...geometries: any[]) => any;
  };
}

