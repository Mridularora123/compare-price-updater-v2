import { useState } from "react";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { calculateCompareAtPrice } from "../utils/comparePrice";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const discount = Number(formData.get("discount"));

  if (isNaN(discount) || discount < 0 || discount > 100) {
    return {
      success: false,
      message: "Please enter a valid discount between 0 and 100.",
    };
  }

  let updatedProducts = 0;

  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {

  const response = await admin.graphql(
    `
    #graphql
    query GetProducts($after: String) {
      products(first: 50, after: $after) {
        nodes {
          id
          title
          variants(first: 50) {
            nodes {
              id
              price
              compareAtPrice
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    `,
    {
      variables: {
        after,
      },
    }
  );

  const responseJson = await response.json();

  console.log(
    "Fetched:",
    responseJson.data.products.nodes.length,
    "Has Next:",
    responseJson.data.products.pageInfo.hasNextPage
  );

  hasNextPage = responseJson.data.products.pageInfo.hasNextPage;
  after = responseJson.data.products.pageInfo.endCursor;

  for (const product of responseJson.data.products.nodes) {

    if (!product.variants.nodes.length) {
      continue;
    }

    const variants = product.variants.nodes.map((variant) => ({
      id: variant.id,
      compareAtPrice: calculateCompareAtPrice(
        variant.price,
        discount
      ),
    }));

    const updateResponse = await admin.graphql(
      `#graphql
      mutation UpdateVariant(
        $productId: ID!,
        $variants: [ProductVariantsBulkInput!]!
      ) {
        productVariantsBulkUpdate(
          productId: $productId
          variants: $variants
        ) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          productId: product.id,
          variants,
        },
      }
    );

    const updateJson = await updateResponse.json();

    if (updateJson.errors) {
      console.error(updateJson.errors);
    }

    if (
      updateJson.data?.productVariantsBulkUpdate?.userErrors?.length
    ) {
      console.error(
        updateJson.data.productVariantsBulkUpdate.userErrors
      );
    }

    console.log(updateJson);

    updatedProducts++;
  }

}

  // console.log(product);
  // console.log(variant);

  // console.log(responseJson);

  return {
    success: true,
    updatedProducts,
  };
};

export default function Index() {
  const [discount, setDiscount] = useState("");
  const fetcher = useFetcher();
  const isLoading =
  fetcher.state === "loading" ||
  fetcher.state === "submitting";

  const applyDiscount = () => {
    fetcher.submit(
      { discount },
      {
        method: "POST",
      }
    );
  };

  return (
    <s-page heading="Compare Price Updater">
      <s-section>
        <s-stack direction="block" gap="base">

          <s-text-field
            label="Discount Percentage"
            placeholder="Enter a discount percentage (Example : 5)"
            value={discount}
            onInput={(e) => setDiscount(e.target.value)}
          ></s-text-field>

          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
              onClick={applyDiscount}
            >
              Apply Discount
            </s-button>

            {/* <s-button variant="secondary">
              Restore Compare Prices
            </s-button> */}
          </s-stack>

          {fetcher.data?.success && (
            <s-banner tone="success">
              Successfully updated {fetcher.data.updatedProducts} products.
            </s-banner>
          )}

        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};