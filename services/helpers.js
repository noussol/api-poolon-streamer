const forge = require('node-forge');
const jwt = require('jsonwebtoken');
const JWT_SECRET = global.sharedConfig.JWT_SECRET;


const privateKey = "-----BEGIN PRIVATE KEY-----\
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDnQ+avTAA0SNWH\
c7BrqG5vCHixMIuZ3An7h9oHgnZc/uvSTro7HmQnzbj+wUvJEMmQLlCVgK5kGeMF\
RbNulotjkJXfOb4B9bj98oP+YWSMX1sM2z3lNEuw+FIaet/89PZxlO5gZ4YO1zJX\
+rXbb2dIfTLxbmWTJAWKB6HCoeBThR8uFXLI680/8eV4Fd+YyqojRfpo5Y5Mokzr\
mcyX+yqjVSq10HgPK5oVLRaj9qCqvCMdVYEfmQReCl0UId8CHQuqbk6LMR9QlX6p\
28vUH8bzCd60cnCZG8vHfpNslJiL8EWzZz2d+mtpO5z8TeovGDT+USqGr3SK7Ker\
N37Kws6PAgMBAAECggEADrEqIR3Xb3rnEd1gKl6/cU9c94jJfaNUgQXO7KY1pc/O\
JIS64RGbtEmmBI08JtBptb6zgOP1cEeSvB2C+jYXMeKYGt/cudwl/gAfsZP3YtGW\
A7mT85FAc8Q61xLSUwwu8eVPxZEeG6hBOwSi9AdeTOUjTOJCErh5n5y/gpFtInEW\
KE52mKy+DFvEfHFfTZBxp+RBnRt9GRi8hikhocOnVHz8hA6NPLN3GOQfw2JHX7nw\
Pt94O3GLVoeTxxrN48uEJhBVXH2zsAc0lhs8GYQgRGnl0x9ufS11kfCDCLbaqAj2\
IHK0iDYCiJ2oTF5PJXkX7WQhQ3r5BoZiA0iHsWWxMQKBgQD/AA2imPmBXRUUiobQ\
hooPSHBOcYOMF/bfq2Bayoixd5UyHqytrQTPdd7thcHYAbNWBfRvcEWFeaVxQ6cM\
R+phHtEzVorQ5RWb5mlUmn57XSYsKKrY3aGmE4QK6ixo67ZzqGDb01aHnb0ED5pA\
bfaA1gGM0oeW4oUNhc/RHSq8sQKBgQDoLAZX8QZTz9Ag8KRRczuEyovLjFQB/Dwo\
uvE9usyTijxMBnUWtCGzU+DT5ZrlvkJDIG9rdfkICKVXINaADWUuVlYnuqAVzqdK\
sAdAPZUC4ABlp9UkxrOfRL5+Oiq87eBY63Y6QsB/MeOQWHs/hMxlo823PqPafczO\
lYX+KzAPPwKBgQDQUhbRku+iw4yJL3JbwM3hFmjJbOru9FT2/WbGRVfOw8bbHzwq\
1oJrifwJR5DJCvqbeFntAGeLV4nVMlOyML5FgYueyUC2z7ALoPzD5UMXPU4GHWMV\
sFpy9taUpCKLxKVVb2VRsSGrwS29t5FouWz8a9jwVr32gi/4kCzqxU04wQKBgF+6\
d0sfWCqKjxhl4Hqs9qeEFCvzSlgfNnbczcdUFDHpV39JUlHwJ80XEqaMD1gXIJ8o\
6of2dp33YqUQJyFZZJS8iH2NF6CmOpgzCGpWefBbiA5iKyIkw78xyxGkziZkNpKz\
U2YmS9SmL1w+/2JrURO/fHzH2SunnyC2yi7Ig+JlAoGBAK/ypZdnOF4z4r7aAhvs\
/DXHoK9ZRa0Cz5K5jfVeVYbWsLc/z5IVcpKUQi/Q6Vimo7M2iD1fMhVFm/aAp0xM\
z0iPQLPinmM2SKp2K8LgoUWz81Vq7ohEMJNNk26Qo+ZnC1ELy3Ys9guXg17KOy4U\
+7YypJOEJk4LVn7/UMmdEZ1S\
-----END PRIVATE KEY-----"


exports.decryptPassword = (encryptedPassword) => {
  const privateKeyForge = forge.pki.privateKeyFromPem(privateKey);
  const decrypted = privateKeyForge.decrypt(forge.util.decode64(encryptedPassword), 'RSA-OAEP');
  return decrypted;
}

exports.authorizeUser = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    console.error('Authorization token missing.');
    return res.status(401).json({ error: 'Not allowed' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Use your environment variable for the secret
    req.user = decoded; // Attach decoded user data to the request object
    next(); // Proceed to the next middleware/handler
  } catch (error) {
    console.error('Invalid authorization token:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
