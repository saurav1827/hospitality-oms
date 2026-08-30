const apiKey = "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";

async function test() {
    const NVIDIA_ENDPOINT = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell'
    try {
        const response = await fetch(NVIDIA_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: "A beautiful cafe",
                mode: 'base',
                seed: 0,
            }),
        });

        if (!response.ok) {
            console.log("FAIL", await response.text());
        } else {
            console.log("SUCCESS!");
            const data = await response.json();
            console.log(Object.keys(data));
            if (data.artifacts) {
               console.log("Got artifacts!", data.artifacts.length);
            } else if (data.image) {
               console.log("Got image directly?");
            } else {
               console.log(data);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
test();
