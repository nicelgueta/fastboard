
const getKvStoreKey = (storeName: string, key: string) => {
    return `kvstore-${storeName}-${key}`;
}
const useKvStore = (storeName: string) => {
    const list = (): string[] => {
        const allkeysJson = localStorage.getItem("allKvStoreKeys");
        let allKeys = JSON.parse(allkeysJson||"[]");
        allKeys = allKeys.filter((key: string) => key.startsWith(`kvstore-${storeName}`));
        allKeys = allKeys.map((key: string) => key.replace(`kvstore-${storeName}-`, ""));
        return allKeys;
    };
    const set = (key: string, value: any) => {
        const allkeysJson = localStorage.getItem("allKvStoreKeys");
        const allKeys = JSON.parse(allkeysJson||"[]");
        const newKey = getKvStoreKey(storeName, key);
        if (!allKeys.includes(newKey)) {
            allKeys.push(newKey);
            localStorage.setItem("allKvStoreKeys", JSON.stringify(allKeys));
        }
        localStorage.setItem(newKey, JSON.stringify(value));
    };
    const get = (key: string): any => {
        return JSON.parse(
            localStorage.getItem(getKvStoreKey(storeName, key))||"{}"
        );
    };

    return { get, set, list };
}

export default useKvStore;