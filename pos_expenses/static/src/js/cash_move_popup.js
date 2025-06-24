/** @odoo-module **/
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { CashMovePopup } from "@point_of_sale/app/navbar/cash_move_popup/cash_move_popup";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

patch(CashMovePopup.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.state.expenseProducts = [];
        this.state.selectedExpenseProductId = null;
        this.loadExpenseProducts();
    },

    async loadExpenseProducts() {
        const domain = [["detailed_type", "=", "service"], ["can_be_expensed", "=", true]];
        const fields = ["id", "name"];
        const products = await this.orm.searchRead("product.product", domain, fields);
        this.state.expenseProducts = products;
    },

    async confirm() {
        const amount = parseFloat(this.state.amount);
        const formattedAmount = this.env.utils.formatCurrency(amount);
        if (!amount) {
            this.notification.add(_t("Cash in/out of %s is ignored.", formattedAmount), 3000);
            return this.props.close();
        }

        const type = this.state.type;
        const translatedType = _t(type);
        // Buscar el producto por ID para obtener su name

        let selectedProductName = "";
         if (this.state.selectedExpenseProductId) {
            const selectedProduct = this.state.expenseProducts.find(
                (p) => p.id === Number(this.state.selectedExpenseProductId)
            );
            selectedProductName = selectedProduct ? selectedProduct.name : "";
        }
        const extras = {
            formattedAmount,
            translatedType,
            selectedProductName
        };

        const reason = this.state.reason.trim();
        const reasonWithProduct = reason + (selectedProductName ? ` - ${selectedProductName}` : "");

        await this.orm.call("pos.session", "try_cash_in_out", [
            [this.pos.pos_session.id],
            type,
            amount,
            reasonWithProduct,
            extras,
        ]);

        await this.pos.logEmployeeMessage(
            `${_t("Cash")} ${translatedType} - ${_t("Amount")}: ${formattedAmount}`,
            "CASH_DRAWER_ACTION"
        );

        await this.printer.print(this.constructor.components.CashMoveReceipt, {
            reason,
            translatedType,
            formattedAmount,
            headerData: this.pos.getReceiptHeaderData(),
            date: new Date().toLocaleString(),
        });

        this.props.close();
        this.notification.add(
            _t("Successfully made a cash %s of %s.", type, formattedAmount),
            3000
        );
    },
});
