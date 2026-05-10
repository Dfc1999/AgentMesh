export interface IPythonSubprocess {
  run<TInput, TOutput>(scriptPath: string, input: TInput): Promise<TOutput>;
}
