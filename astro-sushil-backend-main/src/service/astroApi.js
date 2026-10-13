import crypto from "crypto";

export const generateSignature = (secretKey, method, url, body = null) => {
  const timestamp = Date.now().toString();

  const bodyString = body ? JSON.stringify(body) : "";
  const raw = `${timestamp}.${method}.${url}.${bodyString}`;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(raw)
    .digest("hex");

  return { timestamp, signature };
};

export const astrologyApiRequest = async ({
  path,
  method = "POST",
  body = null,
}) => {
  const secretKey = process.env.ASTROLOGY_API_SECRET_KEY;
  const publicKey = process.env.ASTROLOGY_API_PUBLIC_KEY;
  const pathUrl = `/api/v1/astrology/${path}`;
  const reqUrl = process.env.ASTROLOGY_API_URL + pathUrl;

  const { timestamp, signature } = generateSignature(
    secretKey,
    method,
    pathUrl,
    body,
  );
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": publicKey,
    "x-signature": signature,
    "x-timestamp": timestamp,
  };
  const response = await fetch(reqUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await response.json();

  console.log("Astrology API Response Status:", data);

  if (!response.ok) {
    console.log(data);
    throw new Error(
      data?.error ||
        data.errors?.[0]?.message ||
        "Astrology API request failed",
    );
  }
  return data;
};

export const getUserBalance = async () => {
  const secretKey = process.env.ASTROLOGY_API_SECRET_KEY;
  const publicKey = process.env.ASTROLOGY_API_PUBLIC_KEY;
  const pathUrl = "/api/user/balance";
  const reqUrl = process.env.ASTROLOGY_API_URL + pathUrl;

  const method = "GET";

  const { timestamp, signature } = generateSignature(
    secretKey,
    method,
    pathUrl,
    null,
  );

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": publicKey,
    "x-signature": signature,
    "x-timestamp": timestamp,
  };

  const response = await fetch(reqUrl, {
    method,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.errors?.[0]?.message ||
        "Failed to fetch user balance",
    );
  }

  return data;
};