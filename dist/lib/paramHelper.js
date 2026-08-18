export function getParam(param) {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
}
