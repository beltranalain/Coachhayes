// Bottom-sheet tip picker matching the mockup: amount chips ($5/$10/$20/$50 +
// custom), an optional message, and an amber "Tip $X" CTA. Submitting hands the
// amount + message up to the Live screen, which drives Stripe PaymentSheet.

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors, fonts } from "../lib/theme";
import { AmberButton } from "./ui";

const PRESETS = [5, 10, 20, 50];

export function TipSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: number, message: string) => void;
}) {
  const [amount, setAmount] = useState(5);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [message, setMessage] = useState("");

  const value = custom ? Math.max(1, Math.min(500, Number(customVal) || 0)) : amount;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View>
              <Text style={styles.title}>Send a tip</Text>
              <Text style={styles.sub}>Support the show — tips appear live in chat.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.x}>
              <Text style={styles.xText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {PRESETS.map((a) => {
              const sel = !custom && amount === a;
              return (
                <Pressable
                  key={a}
                  onPress={() => {
                    setCustom(false);
                    setAmount(a);
                  }}
                  style={[styles.chip, sel && styles.chipSel]}
                >
                  <Text style={[styles.chipText, sel && { color: "#1a1205" }]}>${a}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setCustom(true)}
              style={[styles.chip, styles.chipWide, custom && styles.chipSel]}
            >
              {custom ? (
                <TextInput
                  value={customVal}
                  onChangeText={setCustomVal}
                  keyboardType="number-pad"
                  placeholder="Custom $"
                  placeholderTextColor="#1a1205"
                  style={[styles.chipText, { color: "#1a1205", minWidth: 90, textAlign: "center", padding: 0 }]}
                  autoFocus
                />
              ) : (
                <Text style={styles.chipText}>Custom</Text>
              )}
            </Pressable>
          </View>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Add a message (optional)"
            placeholderTextColor={colors.dim}
            style={styles.msgField}
            maxLength={200}
            multiline
          />

          <AmberButton label={`Tip $${value}`} onPress={() => onSubmit(value, message.trim())} />
          <Text style={styles.stripe}>Powered by Stripe</Text>
          <Pressable onPress={onClose} style={{ paddingVertical: 12 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(4,3,3,0.55)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  grabber: { width: 40, height: 5, borderRadius: 99, backgroundColor: colors.dim, alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontFamily: fonts.bold, fontSize: 19, color: colors.cream },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  x: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  xText: { color: colors.muted, fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  chip: {
    width: "30%",
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  chipWide: { width: "100%" },
  chipSel: { backgroundColor: colors.amber, borderColor: colors.amber },
  chipText: { fontFamily: fonts.bold, fontSize: 17, color: colors.cream },
  msgField: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.cream,
    marginBottom: 18,
    minHeight: 60,
    textAlignVertical: "top",
  },
  stripe: { textAlign: "center", fontFamily: fonts.body, fontSize: 10.5, color: colors.dim, marginTop: 12 },
  cancel: { textAlign: "center", fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
});
