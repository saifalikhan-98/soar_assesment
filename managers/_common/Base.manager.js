export default class BaseManager {
    constructor({ config, cache, utils, cortex, oyster }) {
        this.config = config;
        this.cache = cache;
        this.utils = utils;
        this.cortex = cortex;
        this.oyster = oyster;
    }
}
