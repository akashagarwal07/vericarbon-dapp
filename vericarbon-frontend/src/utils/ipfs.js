// src/utils/ipfs.js
import axios from 'axios';

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_API_SECRET = import.meta.env.VITE_PINATA_API_SECRET;

export const uploadToPinata = async (file) => {
    if (!file) return null;

    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

    // Create a form data object
    let data = new FormData();
    data.append('file', file);

    // Optional: Metadata
    const metadata = JSON.stringify({
        name: 'VeriCarbon_Project_Doc',
    });
    data.append('pinataMetadata', metadata);

    try {
        const response = await axios.post(url, data, {
            maxBodyLength: 'Infinity',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_API_SECRET
            }
        });

        // Return the IPFS Hash (CID)
        return `ipfs://${response.data.IpfsHash}`;

    } catch (error) {
        console.error("Error uploading to Pinata:", error);
        throw new Error("IPFS Upload Failed");
    }
};