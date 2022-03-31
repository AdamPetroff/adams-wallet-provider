export default async function promiseTimeout<T>(prom: Promise<T>, time: number): Promise<T> {
  const sym = Symbol()

	const res = await Promise.race([
		new Promise((resolve, reject) => prom.then((result) => resolve(result)).catch((e) => reject(e))),
		new Promise((resolve, rej) => setTimeout(() => resolve(sym), time))
	]) as T | typeof sym;

  if(res === sym) {
    throw new Error("Promise timeouted");
  }

  return res
}