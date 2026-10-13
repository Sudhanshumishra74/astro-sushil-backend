import sharp from "sharp";

export const createWatermarkedImage =
  async (
    file,
    watermarkText = "Astro Sushil",
  ) => {
    const image = sharp(file.buffer);

    const metadata =
      await image.metadata();

    const width =
      metadata.width || 1200;

    const height =
      metadata.height || 1200;

    const fontSize =
      Math.floor(width / 12);

    const svg = `
      <svg width="${width}" height="${height}">
       <style>
  .title {
    fill: rgb(255, 255, 255);
    font-size: ${fontSize}px;
    font-weight: bold;
  }
</style>

        <text
          x="50%"
          y="50%"
          text-anchor="middle"
          dominant-baseline="middle"
          transform="rotate(-30 ${width / 2} ${height / 2})"
          class="title"
        >
          ${watermarkText}
        </text>
      </svg>
    `;

    return await image
      .composite([
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
  };