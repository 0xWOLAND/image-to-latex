import os
import base64
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

class GrokAPI:
    def __init__(self):
        self.api_key = os.getenv('XAI_API_KEY')
        if not self.api_key:
            raise ValueError("XAI_API_KEY not found in environment variables")
        
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.x.ai/v1"
        )

    def encode_image(self, image_path: str) -> str:
        """
        Encode image to base64
        
        Args:
            image_path (str): Path to the image file
            
        Returns:
            str: Base64 encoded image
        """
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    def query_with_image(self, image_path: str, prompt: str = "Convert this image to LaTeX code") -> str:
        """
        Send an image query to Grok Vision API
        
        Args:
            image_path (str): Path to the image file
            prompt (str): The instruction for processing the image
            
        Returns:
            str: The response from Grok
        """
        try:
            # Encode image
            base64_image = self.encode_image(image_path)

            completion = self.client.chat.completions.create(
                model="grok-vision-beta",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ]
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Error querying Grok Vision API: {e}")
            return None

def main():
    try:
        grok = GrokAPI()
        
        # Example image query
        image_path = "image.png"  # Make sure this image exists in your directory
        prompt = "Convert this image to LaTeX code. Please provide the complete LaTeX code that would reproduce this image."
        
        response = grok.query_with_image(image_path, prompt)
        
        if response:
            print("Grok's LaTeX conversion:")
            print(response)
        else:
            print("Failed to get response from Grok")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 